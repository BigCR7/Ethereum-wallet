"use strict";

import * as errors from "@ethersproject/errors";

import { Bytes, concat, hexlify } from "@ethersproject/bytes";
import { nameprep, toUtf8Bytes } from "@ethersproject/strings";
import { keccak256 } from "@ethersproject/keccak256";

///////////////////////////////

const Zeros = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const Partition = new RegExp("^((.*)\\.)?([^.]+)$");

export function isValidName(name: string): boolean {
    try {
        let comps = name.split(".");
        for (let i = 0; i < comps.length; i++) {
            if (nameprep(comps[i]).length === 0) {
                throw new Error("empty")
            }
        }
        return true;
    } catch (error) { }
    return false;
}

export function namehash(name: string): string {
    if (typeof(name) !== "string") {
        errors.throwError("invalid address - " + String(name), errors.INVALID_ARGUMENT, {
            argument: "name",
            value: name
        });
    }

    let result: string | Uint8Array = Zeros;
    while (name.length) {
        let partition = name.match(Partition);
        let label = toUtf8Bytes(nameprep(partition[3]));
        result = keccak256(concat([result, keccak256(label)]));

        name = partition[2] || "";
    }

    return hexlify(result);
}


export function id(text: string): string {
    return keccak256(toUtf8Bytes(text));
}

export const messagePrefix = "\x19Ethereum Signed Message:\n";

export function hashMessage(message: Bytes | string): string {
    if (typeof(message) === "string") { message = toUtf8Bytes(message); }
    return keccak256(concat([
        toUtf8Bytes(messagePrefix),
        toUtf8Bytes(String(message.length)),
        message
    ]));
}
