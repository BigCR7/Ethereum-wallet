"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var bignumber_1 = require("@ethersproject/bignumber");
var constants_1 = require("@ethersproject/constants");
var abstract_coder_1 = require("./abstract-coder");
var NumberCoder = /** @class */ (function (_super) {
    __extends(NumberCoder, _super);
    function NumberCoder(size, signed, localName) {
        var _this = this;
        var name = ((signed ? "int" : "uint") + (size * 8));
        _this = _super.call(this, name, name, localName, false) || this;
        _this.size = size;
        _this.signed = signed;
        return _this;
    }
    NumberCoder.prototype.encode = function (writer, value) {
        var v = bignumber_1.BigNumber.from(value);
        // Check bounds are safe for encoding
        var maxUintValue = constants_1.MaxUint256.maskn(writer.wordSize * 8);
        if (this.signed) {
            var bounds = maxUintValue.maskn(this.size * 8 - 1);
            if (v.gt(bounds) || v.lt(bounds.add(constants_1.One).mul(constants_1.NegativeOne))) {
                this._throwError("value out-of-bounds", value);
            }
        }
        else if (v.lt(constants_1.Zero) || v.gt(maxUintValue.maskn(this.size * 8))) {
            this._throwError("value out-of-bounds", value);
        }
        v = v.toTwos(this.size * 8).maskn(this.size * 8);
        if (this.signed) {
            v = v.fromTwos(this.size * 8).toTwos(8 * writer.wordSize);
        }
        return writer.writeValue(v);
    };
    NumberCoder.prototype.decode = function (reader) {
        var value = reader.readValue().maskn(this.size * 8);
        if (this.signed) {
            value = value.fromTwos(this.size * 8);
        }
        return reader.coerce(this.name, value);
    };
    return NumberCoder;
}(abstract_coder_1.Coder));
exports.NumberCoder = NumberCoder;
