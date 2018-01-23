
# usb-cdc-acm

Userspace javascript implementation of a USB CDC ACM driver, on top of libusb.

[![Build Status](https://travis-ci.org/NordicPlayground/node-usb-cdc-acm.svg?branch=master)](https://travis-ci.org/NordicPlayground/node-usb-cdc-acm)

This is part of [Nordic Semiconductor](http://www.nordicsemi.com/)'s javascript tools to
interface with nRF SoCs and development kits. Although USB CDC ACM is part of the USB specifications
and a *de facto* standard when it comes to emulating a serial port connection on an embedded device, 
Nordic Semiconductor cannot offer support for other hardware platforms. This software is provided "as is".

## Motivation

Sometimes you want to fetch info from the USB descriptors via the 
[NodeJS `usb` module](https://github.com/tessel/node-usb), and at the same time use the CDC ACM 
interface to send and receive data. But this is not possible with some host configurations
(notably, win32/win64 platforms and their need to manually switch the driver via Zadig or the like).

## API

`usb-cdc-acm` provides a [duplex `Stream` interface](https://nodejs.org/api/stream.html). Please
refer to NodeJS's documentation about `Stream`s for a full API spec.

Other than that, `usb-cdc-acm` provides two entry points. Either of those need you to use `usb` to
fetch a reference to the `Device` or to a CDC `Interface`.

Use the factory method when your USB device only has one CDC ACM interface:
```js
var usb = require('usb');
const UsbCdcAcm = require('usb-cdc-acm');

var device = usb.findByIds( 0x1915, 0x520f ); // VID/PID for Nordic Semi / USB CDC demo

// The device MUST be open before instantiating the UsbCdcAcm stream!
device.open();

// An options object with the baud rate is optional.
let stream = UsbCdcAcm.fromUsbDevice(device, { baudRate: 1000000});

// Then, use it as any other Stream
stream.on('data', function(data) { console.log('recv: ', data); });
stream.write('Hello world!');

// Remember to destroy the stream and close the device when finished!
// Failure to do so might leave the USB device in an ususable state for other applications.
setTimeout(function(){ 
    stream.destroy();
    device.close();
}, 5000);
```

If the device has several CDC ACM interfaces and finer control is needed, 
```js
// An options object with the baud rate is optional.
let stream = new UsbCdcAcm(device.interfaces[0], { baudRate: 1000000});
```

For a more complete example, check the `test/test.js` file.


## Legal

Distributed under a BSD-3 license. See the `LICENSE` file for details.

