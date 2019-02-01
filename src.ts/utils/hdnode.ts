"use strict";

// See: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
// See: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki

import * as errors from '../errors';

// The English language word list.
// For additional word lists, please see /src.tc/wordlists/
import { langEn } from '../wordlists/lang-en';

// Automatically register English?
//import { register } from '../wordlists/wordlist';
//register(langEn);

import { Base58 } from "./basex";
import { arrayify, concat, hexDataSlice, hexZeroPad, hexlify } from './bytes';
import { BigNumber, bigNumberify } from './bignumber';
import { toUtf8Bytes, UnicodeNormalizationForm } from './utf8';
import { pbkdf2 } from './pbkdf2';
import { computeHmac, SupportedAlgorithms } from './hmac';
import { defineReadOnly, isType, setType } from './properties';
import { computeAddress, KeyPair } from './secp256k1';
import { ripemd160, sha256 } from './sha2';

const N = bigNumberify("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");

// Imported Types
import { Arrayish } from './bytes';
import { Wordlist } from './wordlist';


// "Bitcoin seed"
const MasterSecret = toUtf8Bytes('Bitcoin seed');

const HardenedBit = 0x80000000;

// Returns a byte with the MSB bits set
function getUpperMask(bits: number): number {
   return ((1 << bits) - 1) << (8 - bits);
}

// Returns a byte with the LSB bits set
function getLowerMask(bits: number): number {
   return (1 << bits) - 1;
}

function bytes32(value: Arrayish | BigNumber | number): string {
    return hexZeroPad(hexlify(value), 32);
}

function base58check(data: Uint8Array): string {
    let checksum = hexDataSlice(sha256(sha256(data)), 0, 4);
    return Base58.encode(concat([ data, checksum ]));
}

const _constructorGuard: any = {};

export const defaultPath = "m/44'/60'/0'/0/0";

export class HDNode {
    readonly privateKey: string;
    readonly publicKey: string;

    readonly fingerprint: string;
    readonly parentFingerprint: string;

    readonly address: string;

    readonly mnemonic: string;
    readonly path: string;

    readonly chainCode: string;

    readonly index: number;
    readonly depth: number;

    /**
     *  This constructor should not be called directly.
     *
     *  Please use:
     *   - fromMnemonic
     *   - fromSeed
     */
    constructor(constructorGuard: any, privateKey: string, publicKey: string, parentFingerprint: string, chainCode: string, index: number, depth: number, mnemonic: string, path: string) {
        errors.checkNew(this, HDNode);

        if (constructorGuard !== _constructorGuard) {
            throw new Error('HDNode constructor cannot be called directly');
        }

        if (privateKey) {
            let keyPair = new KeyPair(privateKey);
            defineReadOnly(this, 'privateKey', keyPair.privateKey);
            defineReadOnly(this, 'publicKey', keyPair.compressedPublicKey);
        } else {
            defineReadOnly(this, 'privateKey', null);
            defineReadOnly(this, 'publicKey', hexlify(publicKey));
        }

        defineReadOnly(this, 'parentFingerprint', parentFingerprint);
        defineReadOnly(this, 'fingerprint', hexDataSlice(ripemd160(sha256(this.publicKey)), 0, 4));

        defineReadOnly(this, 'address', computeAddress(this.publicKey));

        defineReadOnly(this, 'chainCode', chainCode);

        defineReadOnly(this, 'index', index);
        defineReadOnly(this, 'depth', depth);

        defineReadOnly(this, 'mnemonic', mnemonic);
        defineReadOnly(this, 'path', path);

        setType(this, 'HDNode');
    }

    get extendedKey(): string {
        // We only support the mainnet values for now, but if anyone needs
        // testnet values, let me know. I believe current senitment is that
        // we should always use mainnet, and use BIP-44 to derive the network
        //   - Mainnet: public=0x0488B21E, private=0x0488ADE4
        //   - Testnet: public=0x043587CF, private=0x04358394

        if (this.depth >= 256) { throw new Error("Depth too large!"); }

        return base58check(concat([
            ((this.privateKey != null) ? "0x0488ADE4": "0x0488B21E"),
            hexlify(this.depth),
            this.parentFingerprint,
            hexZeroPad(hexlify(this.index), 4),
            this.chainCode,
            ((this.privateKey != null) ? concat([ "0x00", this.privateKey ]): this.publicKey),
        ]));
    }

    neuter(): HDNode {
        return new HDNode(_constructorGuard, null, this.publicKey, this.parentFingerprint, this.chainCode, this.index, this.depth, null, this.path);
    }

    private _derive(index: number): HDNode {
        if (index > 0xffffffff) { throw new Error("invalid index - " + String(index)); }

        // Base path
        let path = this.path;
        if (path) { path += '/' + (index & ~HardenedBit); }

        let data = new Uint8Array(37);

        if (index & HardenedBit) {
            if (!this.privateKey) {
                throw new Error('cannot derive child of neutered node');
            }

            // Data = 0x00 || ser_256(k_par)
            data.set(arrayify(this.privateKey), 1);

            // Hardened path
            if (path) { path += "'"; }

        } else {
            // Data = ser_p(point(k_par))
            data.set(arrayify(this.publicKey));
        }

        // Data += ser_32(i)
        for (let i = 24; i >= 0; i -= 8) { data[33 + (i >> 3)] = ((index >> (24 - i)) & 0xff); }

        let I = computeHmac(SupportedAlgorithms.sha512, this.chainCode, data);
        let IL = I.slice(0, 32);
        let IR = I.slice(32);

        // The private key

        let ki: string = null
        // The public key
        let Ki: string = null;

        if (this.privateKey) {
            ki = bytes32(bigNumberify(IL).add(this.privateKey).mod(N));
        } else {
            let ek = new KeyPair(hexlify(IL));
            Ki = ek._addPoint(this.publicKey);
        }

        return new HDNode(_constructorGuard, ki, Ki, this.fingerprint, bytes32(IR), index, this.depth + 1, this.mnemonic, path);
    }

    derivePath(path: string): HDNode {
        let components = path.split('/');

        if (components.length === 0 || (components[0] === 'm' && this.depth !== 0)) {
            throw new Error('invalid path - ' + path);
        }

        if (components[0] === 'm') { components.shift(); }

        let result: HDNode = this;
        for (let i = 0; i < components.length; i++) {
            let component = components[i];
            if (component.match(/^[0-9]+'$/)) {
                let index = parseInt(component.substring(0, component.length - 1));
                if (index >= HardenedBit) { throw new Error('invalid path index - ' + component); }
                result = result._derive(HardenedBit + index);
            } else if (component.match(/^[0-9]+$/)) {
                let index = parseInt(component);
                if (index >= HardenedBit) { throw new Error('invalid path index - ' + component); }
                result = result._derive(index);
            } else {
                throw new Error('invlaid path component - ' + component);
            }
        }

        return result;
    }

    static isHDNode(value: any): value is HDNode {
        return isType(value, 'HDNode');
    }

    static fromExtendedKey(extendedKey: string): HDNode {
        return null;
    }
}

function _fromSeed(seed: Arrayish, mnemonic: string): HDNode {
    let seedArray: Uint8Array = arrayify(seed);
    if (seedArray.length < 16 || seedArray.length > 64) { throw new Error('invalid seed'); }

    let I: Uint8Array = arrayify(computeHmac(SupportedAlgorithms.sha512, MasterSecret, seedArray));

    return new HDNode(_constructorGuard, bytes32(I.slice(0, 32)), null, "0x00000000", bytes32(I.slice(32)), 0, 0, mnemonic, 'm');
}

export function fromMnemonic(mnemonic: string, wordlist?: Wordlist): HDNode {
    // Check that the checksum s valid (will throw an error)
    mnemonicToEntropy(mnemonic, wordlist);

    return _fromSeed(mnemonicToSeed(mnemonic), mnemonic);
}

export function fromSeed(seed: Arrayish): HDNode {
    return _fromSeed(seed, null);
}

export function mnemonicToSeed(mnemonic: string, password?: string): string {
    if (!password) { password = ''; }

    let salt = toUtf8Bytes('mnemonic' + password, UnicodeNormalizationForm.NFKD);

    return hexlify(pbkdf2(toUtf8Bytes(mnemonic, UnicodeNormalizationForm.NFKD), salt, 2048, 64, 'sha512'));
}

export function mnemonicToEntropy(mnemonic: string, wordlist?: Wordlist): string {
    if (!wordlist) { wordlist = langEn; }

    errors.checkNormalize();

    let words = wordlist.split(mnemonic);
    if ((words.length % 3) !== 0) { throw new Error('invalid mnemonic'); }

    let entropy = arrayify(new Uint8Array(Math.ceil(11 * words.length / 8)));

    let offset = 0;
    for (let i = 0; i < words.length; i++) {
        let index = wordlist.getWordIndex(words[i].normalize('NFKD'));
        if (index === -1) { throw new Error('invalid mnemonic'); }

        for (let bit = 0; bit < 11; bit++) {
            if (index & (1 << (10 - bit))) {
                entropy[offset >> 3] |= (1 << (7 - (offset % 8)));
            }
            offset++;
        }
    }

    let entropyBits = 32 * words.length / 3;

    let checksumBits = words.length / 3;
    let checksumMask = getUpperMask(checksumBits);

    let checksum = arrayify(sha256(entropy.slice(0, entropyBits / 8)))[0];
    checksum &= checksumMask;

    if (checksum !== (entropy[entropy.length - 1] & checksumMask)) {
        throw new Error('invalid checksum');
    }

    return hexlify(entropy.slice(0, entropyBits / 8));
}

export function entropyToMnemonic(entropy: Arrayish, wordlist?: Wordlist): string {
    entropy = arrayify(entropy);

    if ((entropy.length % 4) !== 0 || entropy.length < 16 || entropy.length > 32) {
        throw new Error('invalid entropy');
    }

    let indices: Array<number> = [ 0 ];

    let remainingBits = 11;
    for (let i = 0; i < entropy.length; i++) {

        // Consume the whole byte (with still more to go)
        if (remainingBits > 8) {
            indices[indices.length - 1] <<= 8;
            indices[indices.length - 1] |= entropy[i];

            remainingBits -= 8;

        // This byte will complete an 11-bit index
        } else {
            indices[indices.length - 1] <<= remainingBits;
            indices[indices.length - 1] |= entropy[i] >> (8 - remainingBits);

            // Start the next word
            indices.push(entropy[i] & getLowerMask(8 - remainingBits));

            remainingBits += 3;
        }
    }

    // Compute the checksum bits
    let checksum = arrayify(sha256(entropy))[0];
    let checksumBits = entropy.length / 4;
    checksum &= getUpperMask(checksumBits);

    // Shift the checksum into the word indices
    indices[indices.length - 1] <<= checksumBits;
    indices[indices.length - 1] |= (checksum >> (8 - checksumBits));

    if (!wordlist) { wordlist = langEn; }

    return wordlist.join(indices.map((index) => wordlist.getWord(index)));
}

export function isValidMnemonic(mnemonic: string, wordlist?: Wordlist): boolean {
    try {
        mnemonicToEntropy(mnemonic, wordlist);
        return true;
    } catch (error) { }
    return false;
}

