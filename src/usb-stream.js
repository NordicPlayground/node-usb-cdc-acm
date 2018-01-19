
// import EventEmitter from 'events';
// import { Duplex } from 'stream';
// import Debug from 'debug';
// import usb from 'usb';
const Duplex = require('stream').Duplex;
const Debug = require('debug');
const usb = require('usb');

const debug = Debug('usb-stream');


// Utility function.
// Given an interface, assert that it's valid for instantiating a stream from it
// Specifically, the interface must have only one 
// "in" bulk endpoint and one "out" bulk endpoint.
function assertInterface(iface) {
    const endpoints = iface.endpoints;

    return (
        // Only two endpoints, and 
        endpoints.length === 2 && 
        // both are bulk transfer, and
        endpoints[0].transferType === usb.LIBUSB_TRANSFER_TYPE_BULK &&
        endpoints[1].transferType === usb.LIBUSB_TRANSFER_TYPE_BULK &&
        // their direction (in/out) is different
        endpoints[0].direction !== endpoints[1].direction
    );
}


// export class UsbStream extends Duplex {
class UsbStream extends Duplex {
    constructor(iface) {
        
        if (!assertInterface(iface) ){
            throw new Error('Interface is not valid (does not have one "in" bulk endpoint and one "out" bulk endpoint)');
        }
        
        super();
        
        this.iface = iface;
        this.device = iface.device;
        
        const endpoints = iface.endpoints;

        if (endpoints[0].direction === 'in') {
            this.in = endpoints[0];
            this.out = endpoints[1];
        } else {
            this.in = endpoints[1];
            this.out = endpoints[0];
        }
        
        if (iface.isKernelDriverActive()) {
            iface.detachKernelDriver();
        }
        iface.claim();
        
        // Perform a SET_LINE_CODING request
        
        // Perform a USB_CDC_REQ_SET_CONTROL_LINE_STATE (0x22) control transfer
        // This is documented in the PSTN doc of the USB spec, section 6.3.12
        this._controlTransfer(
            0x21, // bmRequestType: [host-to-device, type: class, recipient: iface]
            0x22, // SET_CONTROL_LINE_STATE
            0x03, // 0x02 "Activate carrier" & 0x01 "DTE is present"
            0x00, // index 0 = interface index ???
            new Buffer([])     // No data expected back
//         ).then(()=>{
//             return this._controlTransfer(
//                 0x21, // bmRequestType: [host-to-device, type: class, recipient: iface]
//                 0x20, // SET_LINE_CODING
//                 0x01, // value 0x0
//                 0x00, // index 0
//                 new Uint8Array([0x80, 0x25, 0, 0, 0, 0, 0x08])
//         )
//         })
        ).then( ()=>{
            debug('Control transfer 0x21 0x20 performed');
            
            this.in.on('data', this._onData.bind(this));
            this.in.on('error', (err)=>this.emit('error', err));
            this.out.on('error', (err)=>this.emit('error', err));
            
            this.in.timeout = 1000;
            this.out.timeout = 1000;
        });
        
        
        debug(this.descriptor);
        
//         if (!desc || desc.
    }
    
    _read(){
        debug('_read');
        if (!this.polling) {
            debug('starting polling');
            this.in.startPoll();
            this.polling = true;
        }
    }
    
    _onData(data) {
        debug('_onData ' + data);
        const keepReading = this.push(data);
        if (!keepReading) {
            this._stopPolling();
        }
    }
    
    _onError(err) {
        debug('Error: ', err)
        throw err;
    }
    
    _stopPolling() {
        debug('_stopPolling');
        if (this.polling) {
            debug('stopping polling');
            this.in.stopPoll();
            this.polling = false;
        }
    }
    
    _write(data){
        debug('_write ' + data.toString());

        this.out.transfer(data, (err)=>{
            if (err) {
                debug('Out transfer error: ', err);
                this.emit(err)
            }
        });
    }
    
//     _writev(){}
    
    _final(){
        debug('_final');
        this._stopPolling();
        iface.release();
        iface.attachKernelDriver();
    }
    
    // The device's controlTransfer, wrapped as a Promise
    _controlTransfer(bmRequestType, bRequest, wValue, wIndex, data_or_length) {
        return Promise.resolve();
//         return new Promise((res, rej)=>{
//             this.device.controlTransfer(
//                 bmRequestType, 
//                 bRequest, 
//                 wValue, 
//                 wIndex, 
//                 data_or_length, 
//                 (err, data)=>{ err ? rej(err) : res(data); })
//         });
    }
    
    // Given an instance of Device (from the 'usb' library), opens it, looks through
    // its interfaces, and creates an instance of UsbStream on the first interface which
    // looks like a serial port (having only one "in" bulk endpoint and one 
    // "out" bulk endpoint, see assertInterface() ). 
    // 
    // The given Device must be already open()ed. Conversely, it has to be close()d
    // when the stream is no longer used, or if this method throws an error.
    //
    // Returns an instance of UsbStream.
    static fromUsbDevice(device){
        let ifaces = device.interfaces;
        
        for(let i=0,l=ifaces.length; i<l; i++) {
            const iface = ifaces[i];
            const endpoints = ifaces[i].endpoints;
            
//             debug(iface.descriptor);
//             debug(iface.endpoints);
//             debug(iface.endpoints.map(e=>e.direction));
//             debug(endpoints);
            
            if (assertInterface(iface)) {
               return new UsbStream(iface); 
            }
        }
        
        throw new Error('No valid interfaces found in USB device (they do not have one "in" bulk endpoint and one "out" bulk endpoint)');
    }

}




module.exports = UsbStream;
