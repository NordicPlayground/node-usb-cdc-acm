/* Copyright (c) 2010 - 2018, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY, AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import { Duplex } from 'stream';
import Debug from 'debug';
import usb from 'usb';
import splitDescriptors from './split-descriptors';

// Two debug levels: one for initialization/teardown messages, and one
// for logging all data being sent/recv around
const debugInfo = Debug('usb-cdc-acm:info');
const debugData = Debug('usb-cdc-acm:data');


// Utility function.
// Given an interface, assert that it looks like a CDC management interface
// Specifically, the interface must have only one
// "out" interrupt endpoint, and a CDC Union descriptor.
// Will return boolean `false` if the interface is not valid,
// or an integer number (corresponding to the associated data interface)
function assertCdcInterface(iface) {
    const { endpoints, descriptor } = iface;

    if (descriptor.bInterfaceClass !== usb.LIBUSB_CLASS_COMM || // 2, CDC
        descriptor.bInterfaceSubClass !== 2) { // ACM
        return false;
    }

    // Check it has only one endpoint, and of the right kind
    if (endpoints.length !== 1 ||
        endpoints[0].transferType !== usb.LIBUSB_TRANSFER_TYPE_INTERRUPT ||
        endpoints[0].direction !== 'in') {
        return false;
    }

    // node-usb doesn't parse the CDC Union descriptor inside the interface
    // descriptor, so parse and find it manually here.
    const additionalDescriptors = splitDescriptors(descriptor.extra);
    let slaveInterfaceId = false;

    for (let i = 0, l = additionalDescriptors.length; i < l; i += 1) {
        const desc = additionalDescriptors[i];

        // 0x24 = class-specific descriptor. 0x06 = CDC Union descriptor
        if (desc[1] === 0x24 && desc[2] === 6) {
            if (desc[3] !== iface.id) {
                // Master interface should be the current one!!
                return false;
            }
            [,,,, slaveInterfaceId] = desc; // slaveInterfaceId = desc[4];
        }
    }

    if (slaveInterfaceId === false) {
        // CDC Union descriptor not found, this is not a well-formed USB CDC ACM interface
        return false;
    }

    return (slaveInterfaceId);
}


// Utility function.
// Given an interface, assert that it looks like a CDC data interface
// Specifically, the interface must have only one
// "in" bulk endpoint and one "out" bulk endpoint.
function assertDataInterface(iface) {
    const { endpoints } = iface;

    return (
        // Right class (0x0A)
        iface.descriptor.bInterfaceClass === usb.LIBUSB_CLASS_DATA &&
        // Only two endpoints, and
        endpoints.length === 2 &&
        // both are bulk transfer, and
        endpoints[0].transferType === usb.LIBUSB_TRANSFER_TYPE_BULK &&
        endpoints[1].transferType === usb.LIBUSB_TRANSFER_TYPE_BULK &&
        // their direction (in/out) is different
        endpoints[0].direction !== endpoints[1].direction
    );
}


export default class UsbCdcAcm extends Duplex {
    constructor(ifaceCdc, options = {}) {
        const ifaceDataId = assertCdcInterface(ifaceCdc);
        if (ifaceDataId === false) {
            throw new Error('CDC interface is not valid');
        }

        const ifaceData = ifaceCdc.device.interfaces[ifaceDataId];
        if (!assertDataInterface(ifaceData)) {
            throw new Error('Data interface is not valid');
        }

        super(options);

        this.ifaceCdc = ifaceCdc;
        this.ifaceData = ifaceData;
        this.device = ifaceCdc.device;

        [this.ctr] = ifaceCdc.endpoints;

        if (ifaceData.endpoints[0].direction === 'in') {
            [this.in, this.out] = ifaceData.endpoints;
        } else {
            [this.out, this.in] = ifaceData.endpoints;
        }

        debugInfo('claiming interfaces');

        this._reattachCdcDriverAtFinal = false;
        this._reattachDataDriverAtFinal = false;
        // Linux/mac need to detach the cdc-acm kernel driver, but
        // windows users did that manually, and libusb-win just throws
        // errors when detaching/attaching kernel drivers.
        if (process.platform !== 'win32') {
            if (ifaceCdc.isKernelDriverActive()) {
                ifaceCdc.detachKernelDriver();
                this._reattachCdcDriverAtFinal = true;
            }

            if (ifaceData.isKernelDriverActive()) {
                ifaceData.detachKernelDriver();
                this._reattachDataDriverAtFinal = true;
            }
        }
        ifaceCdc.claim();
        ifaceData.claim();

        this.ctr.on('data', this._onStatus.bind(this));
        this.ctr.on('error', this._onError.bind(this));
        this.ctr.startPoll();


        // Set baud rate and serial line params,
        // then set the line as active
        this._controlSetLineCoding(options.baudRate || 9600)
            .then(() => { this._controlLineState(true); })
            .then(() => { this._controlGetLineCoding(); })
            .then(() => {
                this.in.on('data', data => this._onData(data));
                this.in.on('error', err => this.emit('error', err));
                this.out.on('error', err => this.emit('error', err));

                this.in.timeout = 1000;
                this.out.timeout = 1000;
            });
    }

    _read() {
        debugData('_read');
        if (!this.polling) {
            debugInfo('starting polling');
            this.in.startPoll();
            this.polling = true;
        }
    }

    _onData(data) {
        debugData('_onData ', data);
        const keepReading = this.push(data);
        if (!keepReading) {
            this._stopPolling();
        }
    }

    _onError(err) {
        debugInfo('Error: ', err);
        this.emit('error', err);
        //         throw err;
    }

    _onStatus(sts) { // eslint-disable-line class-methods-use-this
        debugInfo('Status: ', sts);
    }

    _stopPolling() {
        debugInfo('_stopPolling');
        if (this.polling) {
            debugInfo('stopping polling');
            this.in.stopPoll();
            this.polling = false;
        }
    }

    _write(data, encoding, callback) {
        debugData(`_write ${data.toString()}`);

        this.out.transfer(data, callback);
    }

    _destroy() {
        debugInfo('_destroy');

        // Set line state as unused, close all resources, release interfaces
        // (waiting until they are released), reattach kernel drivers if they
        // were attached before, then emit a 'close' event.

        this._controlLineState(false)
            .then(() => {
                this._stopPolling();
                this.ctr.stopPoll();

                this.ctr.removeAllListeners();
                this.in.removeAllListeners();
                this.out.removeAllListeners();

                this.ifaceCdc.release(true, err => {
                    if (err) { throw err; }
                    this.ifaceData.release(true, err2 => {
                        if (err2) { throw err2; }

                        if (this._reattachCdcDriverAtFinal) {
                            this.ifaceCdc.attachKernelDriver();
                        }
                        if (this._reattachDataDriverAtFinal) {
                            this.ifaceData.attachKernelDriver();
                        }

                        debugInfo('All resources released');
                        this.emit('close');
                    });
                });
            });
    }


    // Performs a _controlTransfer() to set the line state.
    // Set active to a truthy value to indicate there is something connected to the line,
    // falsy otherwise.
    // Returns a Promise.
    _controlLineState(active) {
        // This is documented in the PSTN doc of the USB spec, section 6.3.12
        return this._controlTransfer(
            0x21, // bmRequestType: [host-to-device, type: class, recipient: iface]
            0x22, // SET_CONTROL_LINE_STATE
            active ? 0x03 : 0x00, // 0x02 "Activate carrier" & 0x01 "DTE is present"
            this.ifaceCdc.id, // interface index
            Buffer.from([]), // No data expected back
        );
    }

    // Performs a _controlTransfer to set the line coding.
    // This includes bitrate, stop bits, parity, and data bits.
    _controlSetLineCoding(baudRate = 9600) {
        // This is documented in the PSTN doc of the USB spec, section 6.3.10,
        // values for the data structure at the table in 6.3.11.
        const data = Buffer.from([
            0, 0, 0, 0, // Four bytes for the bitrate, will be filled in later.
            0, // Stop bits. 0 means "1 stop bit"
            0, // Parity. 0 means "no parity"
            8, // Number of data bits
        ]);

        data.writeInt32LE(baudRate, 0);

        debugInfo('Setting baud rate to ', baudRate);

        return this._controlTransfer(
            0x21, // bmRequestType: [host-to-device, type: class, recipient: iface]
            0x20, // SET_LINE_CODING
            0x00, // Always zero
            this.ifaceCdc.id, // interface index
            data,
        );
    }

    // Performs a _controlTransfer to get the line coding.
    // This includes bitrate, stop bits, parity, and data bits.
    _controlGetLineCoding() {
        // This is documented in the PSTN doc of the USB spec, section 6.3.11,
        debugInfo('Requesting actual line coding values');

        return this._controlTransfer(
            0xA1, // bmRequestType: [device-to-host, type: class, recipient: iface]
            0x21, // GET_LINE_CODING
            0x00, // Always zero
            this.ifaceCdc.id, // interface index
            7 // Length of data expected back
        ).then(data => {
            const baudRate = data.readInt32LE(0);
            const rawStopBits = data.readInt8(4);
            const rawParity = data.readInt8(5);
            const dataBits = data.readInt8(6);

            let stopBits;
            let parity;
            switch (rawStopBits) {
                case 0: stopBits = 1; break;
                case 1: stopBits = 1.5; break;
                case 2: stopBits = 2; break;
                default: throw new Error('Invalid value for stop bits received (during a GET_LINE_CODING request)');
            }
            switch (rawParity) {
                case 0: parity = 'none'; break;
                case 1: parity = 'odd'; break;
                case 2: parity = 'even'; break;
                case 3: parity = 'mark'; break;
                case 4: parity = 'space'; break;
                default: throw new Error('Invalid value for parity received (during a GET_LINE_CODING request)');
            }

            debugInfo('Got line coding: ', data);
            debugInfo('Reported baud rate: ', baudRate);
            debugInfo('Reported stop bits: ', stopBits);
            debugInfo('Reported parity: ', parity);
            debugInfo('Reported data bits: ', dataBits);

            return data;
        });
    }

    // The device's controlTransfer, wrapped as a Promise
    _controlTransfer(bmRequestType, bRequest, wValue, wIndex, dataOrLength) {
        return new Promise((res, rej) => {
            this.device.controlTransfer(
                bmRequestType,
                bRequest,
                wValue,
                wIndex,
                dataOrLength,
                ((err, data) => (err ? rej(err) : res(data))),
            );
        });
    }


    // Given an instance of Device (from the 'usb' library), opens it, looks through
    // its interfaces, and creates an instance of UsbStream per interface which
    // looks like a CDC ACM control interface (having the right descriptor and endpoints).
    //
    // The given Device must be already open()ed. Conversely, it has to be close()d
    // when the stream is no longer used, or if this method throws an error.
    //
    // Returns an array of instances of UsbCdcAcm.
    static fromUsbDevice(device, options = {}) {
        const ifaces = device.interfaces;

        for (let i = 0, l = ifaces.length; i < l; i += 1) {
            const iface = ifaces[i];

            if (assertCdcInterface(iface) !== false) {
                return new UsbCdcAcm(iface, options);
            }
        }

        throw new Error('No valid CDC interfaces found in USB device');
    }
}
