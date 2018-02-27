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

// Quasi-trivial utility to parse USB descriptors from a Uint8Array
// The first byte in the descriptor is the descriptor length, and they are just
// concatenated together, so something like:
// 5 X X X X 4 X X X 9 X X X X X X X X
// should be splitted into
// 5 X X X X  |  4 X X X   |  9 X X X X X X X X


// Given a Uint8Array, returns an Array of Uint8Array
// Each element of the resulting array is a subarray of the original Uint8Array.
export default function splitDescriptors(bytes) {
    const descs = [];
    if (!(bytes instanceof Uint8Array)) {
        return descs;
    }
    let len = bytes.length;
    let pointer = 0;

    while (len > 0) {
        const descLen = bytes[pointer];
        descs.push(bytes.subarray(pointer, pointer + descLen));
        len -= descLen;
        pointer += descLen;
    }

    return descs;
}


/*
let test = Uint8Array.from([5, 36, 0, 16, 1, 5, 36, 1, 3, 1, 4, 36, 2, 6, 5, 36, 6, 0, 1]);

console.log(splitDescriptors(test));
*/

/*
The previous code should output:

[ Uint8Array [ 5, 36, 0, 16, 1 ],
  Uint8Array [ 5, 36, 1, 3, 1 ],
  Uint8Array [ 4, 36, 2, 6 ],
  Uint8Array [ 5, 36, 6, 0, 1 ] ]
*/
