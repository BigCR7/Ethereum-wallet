import { Coder, Reader, Writer } from "./abstract-coder";
export declare class BooleanCoder extends Coder {
    constructor(localName: string);
    encode(writer: Writer, value: boolean): number;
    decode(reader: Reader): any;
}
