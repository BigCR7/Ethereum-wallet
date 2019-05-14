"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fixednumber_1 = require("@ethersproject/bignumber/fixednumber");
var errors = __importStar(require("@ethersproject/errors"));
var names = [
    "wei",
    "kwei",
    "mwei",
    "gwei",
    "szabo",
    "finney",
    "ether",
];
// Some environments have issues with RegEx that contain back-tracking, so we cannot
// use them.
function commify(value) {
    var comps = String(value).split(".");
    if (comps.length > 2 || !comps[0].match(/^-?[0-9]*$/) || (comps[1] && !comps[1].match(/^[0-9]*$/)) || value === "." || value === "-.") {
        errors.throwError("invalid value", errors.INVALID_ARGUMENT, { argument: "value", value: value });
    }
    // Make sure we have at least one whole digit (0 if none)
    var whole = comps[0];
    var negative = "";
    if (whole.substring(0, 1) === "-") {
        negative = "-";
        whole = whole.substring(1);
    }
    // Make sure we have at least 1 whole digit with no leading zeros
    while (whole.substring(0, 1) === "0") {
        whole = whole.substring(1);
    }
    if (whole === "") {
        whole = "0";
    }
    var suffix = "";
    if (comps.length === 2) {
        suffix = "." + (comps[1] || "0");
    }
    var formatted = [];
    while (whole.length) {
        if (whole.length <= 3) {
            formatted.unshift(whole);
            break;
        }
        else {
            var index = whole.length - 3;
            formatted.unshift(whole.substring(index));
            whole = whole.substring(0, index);
        }
    }
    return negative + formatted.join(",") + suffix;
}
exports.commify = commify;
function formatUnits(value, unitName) {
    if (typeof (unitName) === "string") {
        var index = names.indexOf(unitName);
        if (index !== -1) {
            unitName = 3 * index;
        }
    }
    return fixednumber_1.formatFixed(value, (unitName != null) ? unitName : 18);
}
exports.formatUnits = formatUnits;
function parseUnits(value, unitName) {
    if (typeof (unitName) === "string") {
        var index = names.indexOf(unitName);
        if (index !== -1) {
            unitName = 3 * index;
        }
    }
    return fixednumber_1.parseFixed(value, (unitName != null) ? unitName : 18);
}
exports.parseUnits = parseUnits;
function formatEther(wei) {
    return formatUnits(wei, 18);
}
exports.formatEther = formatEther;
function parseEther(ether) {
    return parseUnits(ether, 18);
}
exports.parseEther = parseEther;
