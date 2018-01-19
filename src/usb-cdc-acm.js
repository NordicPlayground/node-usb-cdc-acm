
// import EventEmitter from 'events';
// import { Duplex } from 'stream';
// import Debug from 'debug';
// import usb from 'usb';
// import util from 'util';
// import splitDescriptors from ('./split-descriptors');
const Duplex = require('stream').Duplex;
const Debug = require('debug');
const usb = require('usb');
const util = require('util');

const debug = Debug('usb-stream');

const splitDescriptors = require('./split-descriptors');


// Utility function.
// Given an interface, assert that it looks like a CDC management interface
// Specifically, the interface must have only one 
// "out" interrupt endpoint, and a CDC Union descriptor.
// Will return boolean `false` if the interface is not valid,
// or an integer number (corresponding to the associated data interface)
function assertCdcInterface(iface) {
    const endpoints = iface.endpoints;
    const descriptor = iface.descriptor;

    if (descriptor.bInterfaceClass !== usb.LIBUSB_CLASS_COMM || // 2, CDC
        descriptor.bInterfaceSubClass !== 2) // ACM
    {
        return false;
    }
    
    // Check it has only one endpoint, and of the right kind
    if (endpoints.length !== 1 || 
        endpoints[0].transferType !== usb.LIBUSB_TRANSFER_TYPE_INTERRUPT ||
        endpoints[0].direction !== "in")
    {
        return false;
    }
    
    // node-usb doesn't parse the CDC Union descriptor inside the interface
    // descriptor, so parse and find it manually here.
    const additionalDescriptors = splitDescriptors(descriptor.extra);
    let slaveInterfaceId = false;
    
    for (let i=0, l=additionalDescriptors.length; i<l; i++) {
        const desc = additionalDescriptors[i];
        
        // 0x24 = class-specific descriptor. 0x06 = CDC Union descriptor
        if (desc[1] === 0x24 && desc[2] === 6) {
            if (desc[3] !== iface.id) {
                // Master interface should be the current one!!
                return false;
            }
            slaveInterfaceId = desc[4];
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
    const endpoints = iface.endpoints;

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


// export class UsbCdcAcm extends Duplex {
class UsbCdcAcm extends Duplex {
    constructor(ifaceCdc) {
        
        const ifaceDataId = assertCdcInterface(ifaceCdc);
        if (ifaceDataId === false){
            throw new Error('CDC interface is not valid');
        }
        
        
        const ifaceData = ifaceCdc.device.interfaces[ifaceDataId];
        
        if (!assertDataInterface(ifaceData) ){
            throw new Error('Data interface is not valid');
        }
        
        super();
        
        this.ifaceCdc = ifaceCdc;
        this.ifaceData = ifaceData;
        this.device = ifaceCdc.device;
        
        this.ctr = ifaceCdc.endpoints[0];
        
        if (ifaceData.endpoints[0].direction === 'in') {
            this.in = ifaceData.endpoints[0];
            this.out = ifaceData.endpoints[1];
        } else {
            this.in = ifaceData.endpoints[1];
            this.out = ifaceData.endpoints[0];
        }
        
        debug('claiming interfaces');
        
//         if (ifaceCdc.isKernelDriverActive()) {
//             ifaceCdc.detachKernelDriver();
//         }
        ifaceCdc.claim();
        
//         if (ifaceData.isKernelDriverActive()) {
//             ifaceData.detachKernelDriver();
//         }
        ifaceData.claim();
        
        this.ctr.on('data', this._onStatus.bind(this));
        this.ctr.on('error', this._onError.bind(this));
        
//         // Perform a SET_LINE_CODING request
        
        // Perform a USB_CDC_REQ_SET_CONTROL_LINE_STATE (0x22) control transfer
        // This is documented in the PSTN doc of the USB spec, section 6.3.12
        this._controlTransfer(
            0x21, // bmRequestType: [host-to-device, type: class, recipient: iface]
            0x22, // SET_CONTROL_LINE_STATE
            0x03, // 0x02 "Activate carrier" & 0x01 "DTE is present"
            ifaceCdc.id, // interface index ???
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
        
        
        debug(this.device.descriptor);
        
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
        this.emit('error', err)
//         throw err;
    }
    
    _onStatus(sts) {
        debug('Status: ', sts)
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
            } else {
                debug('Out transfer OK');
            }
        });
    }
    
//     _writev(){}
    
    _final(){
        debug('_final');
//         this._stopPolling();
        
        
        // Close all resources, waiting for everything,
        // then emit a 'close' event.
        
        this.ctr.removeAllListeners();
        this.in.removeAllListeners();
        this.out.removeAllListeners();
        
        this.ifaceCdc.release(true, (err)=>{
            if (err) { throw err }
            this.ifaceData.release(true, (err2)=>{
                if (err2) { throw err2 }
                
                debug('All resources released');
                this.emit('close');
            });            
        });
        
//         util.promisify(this.ctr.removeAllListeners.bind(this))()
//         .then(util.promisify(this.in.removeAllListeners.bind(this)))
//         .then(util.promisify(this.out.removeAllListeners.bind(this)))
//         .then(util.promisify(this.ifaceCdc.release.bind(this)))
//         .then(util.promisify(this.ifaceData.release.bind(this)))
//         .then(()=>{
//             debug('All resources released');
//             this.emit('close');
//         });
        
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
    // its interfaces, and creates an instance of UsbStream per interface which
    // looks like a CDC ACM control interface (having the right descriptor and endpoints). 
    // 
    // The given Device must be already open()ed. Conversely, it has to be close()d
    // when the stream is no longer used, or if this method throws an error.
    //
    // Returns an array of instances of UsbCdcAcm.
    static fromUsbDevice(device){
        
        let ifaces = device.interfaces;
        
        for(let i=0,l=ifaces.length; i<l; i++) {
            const iface = ifaces[i];
            const endpoints = ifaces[i].endpoints;
            
//             debug(iface.descriptor);
//             debug(iface.endpoints);
//             debug(iface.endpoints.map(e=>e.direction));
//             debug(endpoints);
            
            if (assertCdcInterface(iface) !== false) {
               return new UsbCdcAcm(iface); 
            }
        }
        
        throw new Error('No valid interfaces found in USB device (they do not have one "in" bulk endpoint and one "out" bulk endpoint)');
    }

}




module.exports = UsbCdcAcm;
