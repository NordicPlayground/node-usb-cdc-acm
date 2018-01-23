
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

// let device = usb.findByIds( 0x1915, 0x521f );   // VID/PID for Nordic semi / USB SDFU
let device = usb.findByIds( 0x1915, 0x520f );   // VID/PID for Nordic semi / USB CDC demo
// let device = usb.findByIds( 0x1366, 0x1015 );   // VID/PID for a Segger IMCU (with USB storage)
// let device = usb.findByIds( 0x1366, 0x0105 );   // VID/PID for a Segger IMCU (without USB storage)

// console.log(device);

device.timeout = 100;
debug('Opening device');
device.open();

let ifaces = device.interfaces;

// usb.setDebugLevel(4); // Uncomment for extra USB verbosiness

// let stream = UsbCdcAcm.fromUsbDevice(device, { baudRate: 115200 });
let stream = UsbCdcAcm.fromUsbDevice(device, { baudRate: 1000000});

// Display all data received
stream.on('data', (data)=>{ debug('data', data.toString()); });

// Log other events from the Stream, just in case
stream.on('error', (err)=>{ debug('error',err); });
stream.on('status', (sts)=>{ debug('status', sts); });
stream.on('close', ()=>{debug('Stream is now closed')});
stream.on('drain', ()=>{debug('Stream can be drained now')});

let i = 0

let timer = setInterval(()=>{
    const written = stream.write(`foobar ${i++} ${Date()}\n`);
    debug('Sent a write');
}, 2500);


setTimeout(()=>{
    clearInterval(timer);
    
    debug('Closing the stream');
    stream.destroy();
    
    setTimeout(()=>{
        debug('Closing device');
//         device.close();
    }, 5000);
    
}, 50000);

