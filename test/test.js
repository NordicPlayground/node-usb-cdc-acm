
// import Usb from 'usb';
const usb = require('usb');
const UsbCdcAcm = require('..');

const Debug = require('debug');
const debug = Debug('main');

// let devices = usb.getDeviceList();
// console.log(devices);

Debug.enable('*');


// let device = usb.findByIds( 0x1915, 0x521f );   // VID/PID for Nordic semi / USB SDFU
let device = usb.findByIds( 0x1366, 0x1015 );   // VID/PID for a Segger IMCU

// console.log(device);

device.timeout = 100;
debug('Opening device');
device.open();

let ifaces = device.interfaces;

// console.log(device);
// console.log(ifaces.map(i=>i.descriptor));
// console.log();
// console.log(ifaces.map(i=>i.descriptor.endpoints));


usb.setDebugLevel(4);

let stream = UsbCdcAcm.fromUsbDevice(device);

// // debug('')(stream);
// 
// stream.on('data', (data)=>{ debug('data')(data); });
// stream.on('error', (err)=>{ debug('error')(err); });
// stream.on('status', (sts)=>{ debug('status')(sts); });
stream.on('close', ()=>{debug('Stream is now closed')});

setTimeout(()=>{
//     stream.write(new Uint8Array([0x00, 0xC0]));
    stream.write("foo\r\n");
}, 500);

// 
setTimeout(()=>{
    debug('Closing the stream');
    stream.end();
    
//     setTimeout(()=>{
//         debug('Closing device');
// //         device.close();
//     }, 10500);
    
}, 1000);

