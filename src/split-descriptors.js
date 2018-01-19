// Quasi-trivial utility to parse USB descriptors from a Uint8Array
// The first byte in the descriptor is the descriptor length, and they are just 
// concatenated together, so something like:
// 5 X X X X 4 X X X 9 X X X X X X X X
// should be splitted into
// 5 X X X X  |  4 X X X   |  9 X X X X X X X X


// Given a Uint8Array, returns an Array of Uint8Array
// Each element of the resulting array is a subarray of the original Uint8Array.
// export default function splitDescriptors(bytes) {
function splitDescriptors(bytes) {
    let len = bytes.length;
    let descs = [];
    let pointer = 0;
    
    while(len > 0) {
        descLen = bytes[pointer];
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


module.exports = splitDescriptors;
