'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var convert_1 = require("./convert");
//import * as crypto from 'crypto';
//@TODO: Figure out how to fix crypto
function getRandomValues(buffer) {
    for (var round = 0; round < 20; round++) {
        for (var i = 0; i < buffer.length; i++) {
            if (round) {
                buffer[i] ^= Math.trunc(256 * Math.random());
            }
            else {
                buffer[i] = Math.trunc(256 * Math.random());
            }
        }
    }
    return buffer;
}
function randomBytes(length) {
    if (length <= 0 || length > 1024 || parseInt(length) != length) {
        throw new Error('invalid length');
    }
    var result = new Uint8Array(length);
    getRandomValues(result);
    return convert_1.arrayify(result);
}
exports.randomBytes = randomBytes;
;
