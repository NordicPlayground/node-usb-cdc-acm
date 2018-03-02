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

const splitDescriptors = require('../dist/split-descriptors.cjs.js');

describe('splitDescriptors', () => {
    it('should return empty array for undefined input', () => {
        expect(splitDescriptors()).toEqual([]);
    });

    it('should return empty array for null input', () => {
        expect(splitDescriptors(null)).toEqual([]);
    });

    it('should return empty array for non-Uint8Array', () => {
        expect(splitDescriptors([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([]);
    });

    it('should split input to subarrays', () => {
        const bytes = new Uint8Array([
            5, 36, 0, 16, 1, 5, 36, 1, 3, 1, 4, 36, 2, 6, 5, 36, 6, 0, 1,
        ]);
        expect(splitDescriptors(bytes))
            .toEqual([
                new Uint8Array([5, 36, 0, 16, 1]),
                new Uint8Array([5, 36, 1, 3, 1]),
                new Uint8Array([4, 36, 2, 6]),
                new Uint8Array([5, 36, 6, 0, 1]),
            ]);
    });

    it('should silently ignore insufficient data', () => {
        const bytes = new Uint8Array([15, 36, 0, 16, 1]);
        expect(splitDescriptors(bytes)).toEqual([bytes]);
    });

    it('should throw exception on 0 length descriptor', () => {
        const bytes = new Uint8Array([0, 36, 0, 16, 1]);
        expect(() => {
            splitDescriptors(bytes);
        }).toThrowError();
    });
});
