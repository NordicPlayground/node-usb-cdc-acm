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

/**
 *
 * This demo shows how to get an instance of an usb-cdc-acm Stream,
 * and send/receive data from it.
 *
 * It's quite important to both destroy the stream and close the device
 * when done.
 *
 */

const usb = require('usb');
const UsbCdcAcm = require('..');
const Debug = require('debug');

const debug = Debug('main');

Debug.enable('*');

// const device = usb.findByIds(0x1915, 0x521f); // VID/PID for Nordic semi / USB SDFU
// const device = usb.findByIds(0x1915, 0x520f); // VID/PID for Nordic semi / USB CDC demo
// const device = usb.findByIds(0x1366, 0x1015); // VID/PID for a Segger IMCU (with USB storage)
// const device = usb.findByIds(0x1366, 0x0105); // VID/PID for a Segger IMCU (without USB storage)

const [,, vid, pid] = process.argv;
const vendorId = parseInt(vid || '1915', 16);
const productId = parseInt(pid || '520f', 16);

debug(`Looking for VID/PID: 0x${vendorId.toString(16)}/0x${productId.toString(16)}`);
const device = usb.findByIds(vendorId, productId);

if (!device) {
    console.log('Use this script with nRF USB device');
    process.exit();
}

device.timeout = 100;
debug('Opening device');
device.open();

// usb.setDebugLevel(4); // Uncomment for extra USB verbosiness

// const stream = UsbCdcAcm.fromUsbDevice(device, { baudRate: 115200 });
const stream = UsbCdcAcm.fromUsbDevice(device, { baudRate: 1000000 });

// Display all data received
stream.on('data', data => { debug('data', data.toString()); });

// Log other events from the Stream, just in case
stream.on('error', err => { debug('error', err); });
stream.on('status', sts => { debug('status', sts); });
stream.on('close', () => { debug('Stream is now closed'); });
stream.on('drain', () => { debug('Stream can be drained now'); });

let i = 0;

const timer = setInterval(() => {
    stream.write(`foobar ${i} ${Date()}\n`);
    i += 1;
    debug('Sent a write');
}, 2500);


setTimeout(() => {
    clearInterval(timer);

    debug('Closing the stream');
    stream.destroy();

    setTimeout(() => {
        debug('Closing device');
        // device.close();
    }, 5000);
}, 50000);
