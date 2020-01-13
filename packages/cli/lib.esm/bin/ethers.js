#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from "fs";
import _module from "module";
import { dirname, resolve } from "path";
import REPL from "repl";
import util from "util";
import vm from "vm";
import { ethers } from "ethers";
import { CLI, dump, Plugin } from "../cli";
import { getPassword, getProgressBar } from "../prompt";
import { compile } from "../solc";
function setupContext(path, context, plugin) {
    context.provider = plugin.provider;
    context.accounts = plugin.accounts;
    if (!context.__filename) {
        context.__filename = path;
    }
    if (!context.__dirname) {
        context.__dirname = dirname(path);
    }
    if (!context.console) {
        context.console = console;
    }
    if (!context.require) {
        context.require = _module.createRequireFromPath(path);
    }
    if (!context.process) {
        context.process = process;
    }
    context.ethers = ethers;
    context.version = ethers.version;
    context.Contract = ethers.Contract;
    context.ContractFactory = ethers.ContractFactory;
    context.Wallet = ethers.Wallet;
    context.providers = ethers.providers;
    context.utils = ethers.utils;
    context.abiCoder = ethers.utils.defaultAbiCoder;
    context.BN = ethers.BigNumber;
    context.BigNumber = ethers.BigNumber;
    context.FixedNumber = ethers.FixedNumber;
    context.getAddress = ethers.utils.getAddress;
    context.getContractAddress = ethers.utils.getContractAddress;
    context.getIcapAddress = ethers.utils.getIcapAddress;
    context.arrayify = ethers.utils.arrayify;
    context.hexlify = ethers.utils.hexlify;
    context.joinSignature = ethers.utils.joinSignature;
    context.splitSignature = ethers.utils.splitSignature;
    context.id = ethers.utils.id;
    context.keccak256 = ethers.utils.keccak256;
    context.namehash = ethers.utils.namehash;
    context.sha256 = ethers.utils.sha256;
    context.parseEther = ethers.utils.parseEther;
    context.parseUnits = ethers.utils.parseUnits;
    context.formatEther = ethers.utils.formatEther;
    context.formatUnits = ethers.utils.formatUnits;
    context.randomBytes = ethers.utils.randomBytes;
    context.constants = ethers.constants;
    context.parseTransaction = ethers.utils.parseTransaction;
    context.serializeTransaction = ethers.utils.serializeTransaction;
    context.toUtf8Bytes = ethers.utils.toUtf8Bytes;
    context.toUtf8String = ethers.utils.toUtf8String;
}
const cli = new CLI("sandbox");
class SandboxPlugin extends Plugin {
    static getHelp() {
        return {
            name: "sandbox",
            help: "Run a REPL VM environment with ethers"
        };
    }
    prepareOptions(argParser) {
        const _super = Object.create(null, {
            prepareOptions: { get: () => super.prepareOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareOptions.call(this, argParser);
        });
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 0) {
                this.throwUsageError("Unexpected argument - " + JSON.stringify(args[0]));
            }
            for (let i = 0; i < this.accounts.length; i++) {
                yield this.accounts[i].unlock();
            }
        });
    }
    run() {
        console.log("network: " + this.network.name + " (chainId: " + this.network.chainId + ")");
        let nextPromiseId = 0;
        function promiseWriter(output) {
            if (output instanceof Promise) {
                repl.context._p = output;
                let promiseId = nextPromiseId++;
                output.then((result) => {
                    console.log(`\n<Promise id=${promiseId} resolved>`);
                    console.log(util.inspect(result));
                    repl.context._r = result;
                    repl.displayPrompt(true);
                }, (error) => {
                    console.log(`\n<Promise id=${promiseId} rejected>`);
                    console.log(util.inspect(error));
                    repl.displayPrompt(true);
                });
                return `<Promise id=${promiseId} pending>`;
            }
            return util.inspect(output);
        }
        let repl = REPL.start({
            input: process.stdin,
            output: process.stdout,
            prompt: (this.provider ? this.network.name : "no-network") + "> ",
            writer: promiseWriter
        });
        setupContext(resolve(process.cwd(), "./sandbox.js"), repl.context, this);
        return new Promise((resolve) => {
            repl.on("exit", function () {
                console.log("");
                resolve(null);
            });
        });
    }
}
cli.addPlugin("sandbox", SandboxPlugin);
class InitPlugin extends Plugin {
    static getHelp() {
        return {
            name: "init FILENAME",
            help: "Create a new JSON wallet"
        };
    }
    static getOptionHelp() {
        return [
            {
                name: "[ --force ]",
                help: "Overwrite any existing files"
            }
        ];
    }
    prepareOptions(argParser) {
        const _super = Object.create(null, {
            prepareOptions: { get: () => super.prepareOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareOptions.call(this, argParser);
            this.force = argParser.consumeFlag("force");
        });
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwUsageError("init requires FILENAME");
            }
            this.filename = args[0];
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.force && fs.existsSync(this.filename)) {
                this.throwError('File already exists (use --force to overwrite)');
            }
            console.log("Creating a new JSON Wallet - " + this.filename);
            console.log('Keep this password and file SAFE!! If lost or forgotten');
            console.log('it CANNOT be recovered, by ANYone, EVER.');
            let password = yield getPassword("Choose a password: ");
            let confirm = yield getPassword("Confirm password: ");
            if (password !== confirm) {
                this.throwError("Passwords do not match");
            }
            let wallet = ethers.Wallet.createRandom();
            let progressBar = yield getProgressBar("Encrypting");
            let json = yield wallet.encrypt(password, {}, progressBar);
            try {
                if (this.force) {
                    fs.writeFileSync(this.filename, json);
                }
                else {
                    fs.writeFileSync(this.filename, json, { flag: 'wx' });
                }
                console.log('New account address: ' + wallet.address);
                console.log('Saved:               ' + this.filename);
            }
            catch (error) {
                if (error.code === 'EEXIST') {
                    this.throwError('File already exists (use --force to overwrite)');
                }
                this.throwError('Unknown Error: ' + error.message);
            }
        });
    }
}
cli.addPlugin("init", InitPlugin);
class FundPlugin extends Plugin {
    static getHelp() {
        return {
            name: "fund TARGET",
            help: "Fund TARGET with testnet ether"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (this.network.name !== "ropsten") {
                this.throwError("Funding requires --network ropsten");
            }
            if (args.length !== 1) {
                this.throwUsageError("fund requires ADDRESS");
            }
            this.toAddress = yield this.getAddress(args[0], "Cannot fund ZERO address", false);
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let url = "https:/" + "/api.ethers.io/api/v1/?action=fundAccount&address=" + this.toAddress.toLowerCase();
            return ethers.utils.fetchJson(url).then((data) => {
                console.log("Transaction Hash: " + data.hash);
            });
        });
    }
}
cli.addPlugin("fund", FundPlugin);
class InfoPlugin extends Plugin {
    static getHelp() {
        return {
            name: "info [ TARGET ... ]",
            help: "Dump info for accounts, addresses and ENS names"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            this.queries = [];
            let runners = [];
            this.accounts.forEach((account, index) => {
                this.queries.push(`Account #${index}`);
                runners.push(account.getAddress());
            });
            args.forEach((arg) => {
                if (ethers.utils.isAddress(arg)) {
                    this.queries.push(`Address: ${arg}`);
                }
                else {
                    this.queries.push(`ENS Name: ${arg}`);
                }
                runners.push(this.provider.resolveName(arg));
            });
            this.addresses = yield Promise.all(runners);
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < this.addresses.length; i++) {
                let address = this.addresses[i];
                let { balance, nonce, code, reverse } = yield ethers.utils.resolveProperties({
                    balance: this.provider.getBalance(address),
                    nonce: this.provider.getTransactionCount(address),
                    code: this.provider.getCode(address),
                    reverse: this.provider.lookupAddress(address)
                });
                let info = {
                    "Address": address,
                    "Balance": (ethers.utils.formatEther(balance) + " ether"),
                    "Transaction Count": nonce
                };
                if (code != "0x") {
                    info["Code"] = code;
                }
                if (reverse) {
                    info["Reverse Lookup"] = reverse;
                }
                dump(this.queries[i], info);
            }
        });
    }
}
cli.addPlugin("info", InfoPlugin);
class SendPlugin extends Plugin {
    static getHelp() {
        return {
            name: "send TARGET ETHER",
            help: "Send ETHER ether to TARGET form accounts[0]"
        };
    }
    static getOptionHelp() {
        return [
            {
                name: "[ --allow-zero ]",
                help: "Allow sending to the address zero"
            },
            {
                name: "[ --data DATA ]",
                help: "Include data in the transaction"
            }
        ];
    }
    prepareOptions(argParser) {
        const _super = Object.create(null, {
            prepareOptions: { get: () => super.prepareOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareOptions.call(this, argParser);
            if (this.accounts.length !== 1) {
                this.throwUsageError("send requires exacly one account");
            }
            this.data = ethers.utils.hexlify(argParser.consumeOption("data") || "0x");
            this.allowZero = argParser.consumeFlag("allow-zero");
        });
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 2) {
                this.throwUsageError("send requires exactly ADDRESS and AMOUNT");
            }
            this.toAddress = yield this.getAddress(args[0], "Cannot send to the zero address (use --allow-zero to override)", this.allowZero);
            this.value = ethers.utils.parseEther(args[1]);
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.accounts[0].sendTransaction({
                to: this.toAddress,
                data: this.data,
                value: this.value
            });
            ;
        });
    }
}
cli.addPlugin("send", SendPlugin);
class SweepPlugin extends Plugin {
    static getHelp() {
        return {
            name: "sweep TARGET",
            help: "Send all ether from accounts[0] to TARGET"
        };
    }
    prepareOptions(argParser) {
        const _super = Object.create(null, {
            prepareOptions: { get: () => super.prepareOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareOptions.call(this, argParser);
            if (this.accounts.length !== 1) {
                this.throwUsageError("sweep requires exacly one account");
            }
        });
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwUsageError("sweep requires exactly ADDRESS");
            }
            this.toAddress = yield this.getAddress(args[0]);
            ;
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let { balance, gasPrice, code } = yield ethers.utils.resolveProperties({
                balance: this.provider.getBalance(this.accounts[0].getAddress()),
                gasPrice: (this.gasPrice || this.provider.getGasPrice()),
                code: this.provider.getCode(this.toAddress)
            });
            if (code !== "0x") {
                this.throwError("Cannot sweep to a contract address");
            }
            let maxSpendable = balance.sub(gasPrice.mul(21000));
            if (maxSpendable.lte(0)) {
                this.throwError("Insufficient funds to sweep");
            }
            yield this.accounts[0].sendTransaction({
                to: this.toAddress,
                gasLimit: 21000,
                gasPrice: gasPrice,
                value: maxSpendable
            });
        });
    }
}
cli.addPlugin("sweep", SweepPlugin);
class SignMessagePlugin extends Plugin {
    static getHelp() {
        return {
            name: "sign-message MESSAGE",
            help: "Sign a MESSAGE with accounts[0]"
        };
    }
    static getOptionHelp() {
        return [
            {
                name: "[ --hex ]",
                help: "The message content is hex encoded"
            }
        ];
    }
    prepareOptions(argParser) {
        const _super = Object.create(null, {
            prepareOptions: { get: () => super.prepareOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareOptions.call(this, argParser);
            if (this.accounts.length !== 1) {
                this.throwError("sign-message requires exacly one account");
            }
            this.hex = argParser.consumeFlag("hex");
        });
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwError("send requires exactly MESSAGE");
            }
            this.message = args[0];
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.accounts[0].signMessage(this.message);
        });
    }
}
cli.addPlugin("sign-message", SignMessagePlugin);
class EvalPlugin extends Plugin {
    static getHelp() {
        return {
            name: "eval CODE",
            help: "Run CODE in a VM with ethers"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwError("eval requires exactly CODE");
            }
            this.code = args[0];
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let contextObject = {};
            setupContext(resolve(process.cwd(), "./sandbox.js"), contextObject, this);
            let context = vm.createContext(contextObject);
            let script = new vm.Script(this.code, { filename: "-" });
            let result = script.runInContext(context);
            if (result instanceof Promise) {
                result = yield result;
            }
            console.log(result);
        });
    }
}
cli.addPlugin("eval", EvalPlugin);
class RunPlugin extends Plugin {
    static getHelp() {
        return {
            name: "run FILENAME",
            help: "Run FILENAME in a VM with ethers"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwError("run requires exactly FILENAME");
            }
            this.filename = args[0];
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let contextObject = {};
            setupContext(resolve(this.filename), contextObject, this);
            let context = vm.createContext(contextObject);
            let script = new vm.Script(fs.readFileSync(this.filename).toString(), { filename: this.filename });
            let result = script.runInContext(context);
            if (result instanceof Promise) {
                result = yield result;
            }
            console.log(result);
        });
    }
}
cli.addPlugin("run", RunPlugin);
class WaitPlugin extends Plugin {
    static getHelp() {
        return {
            name: "wait HASH",
            help: "Wait for a transaction HASH to be mined"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwError("wait requires exactly HASH");
            }
            this.hash = args[0];
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Waiting for Transaction:", this.hash);
            let receipt = yield this.provider.waitForTransaction(this.hash);
            dump("Response:", {
                "Block": receipt.blockNumber,
                "Block Hash": receipt.blockHash,
                "Status": (receipt.status ? "ok" : "failed")
            });
        });
    }
}
cli.addPlugin("wait", WaitPlugin);
const WethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WethAbi = [
    "function deposit() payable",
    "function withdraw(uint wad)"
];
class WrapEtherPlugin extends Plugin {
    static getHelp() {
        return {
            name: "wrap-ether VALUE",
            help: "Deposit VALUE into Wrapped Ether (WETH)"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (this.accounts.length !== 1) {
                this.throwError("wrap-ether requires exactly one account");
            }
            if (args.length !== 1) {
                this.throwError("wrap-ether requires exactly VALUE");
            }
            this.value = ethers.utils.parseEther(args[0]);
            const address = yield this.accounts[0].getAddress();
            const balance = yield this.provider.getBalance(address);
            if (balance.lt(this.value)) {
                this.throwError("insufficient ether to wrap");
            }
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let address = yield this.accounts[0].getAddress();
            this.dump("Wrapping ether", {
                "From": address,
                "Value": ethers.utils.formatEther(this.value)
            });
            let contract = new ethers.Contract(WethAddress, WethAbi, this.accounts[0]);
            yield contract.deposit({ value: this.value });
        });
    }
}
cli.addPlugin("wrap-ether", WrapEtherPlugin);
class UnwrapEtherPlugin extends Plugin {
    static getHelp() {
        return {
            name: "unwrap-ether VALUE",
            help: "Withdraw VALUE from Wrapped Ether (WETH)"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (this.accounts.length !== 1) {
                this.throwError("unwrap-ether requires exactly one account");
            }
            if (args.length !== 1) {
                this.throwError("unwrap-ether requires exactly VALUE");
            }
            this.value = ethers.utils.parseEther(args[0]);
        });
    }
    run() {
        const _super = Object.create(null, {
            run: { get: () => super.run }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.run.call(this);
            let address = yield this.accounts[0].getAddress();
            this.dump("Withdrawing Wrapped Ether", {
                "To": address,
                "Valiue": ethers.utils.formatEther(this.value)
            });
            let contract = new ethers.Contract(WethAddress, WethAbi, this.accounts[0]);
            yield contract.withdraw(this.value);
        });
    }
}
cli.addPlugin("unwrap-ether", UnwrapEtherPlugin);
const Erc20Abi = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function balanceOf(address) view returns (uint)",
    "function transfer(address to, uint256 value)"
];
const Erc20AltAbi = [
    "function symbol() view returns (bytes32)",
    "function name() view returns (bytes32)",
];
class SendTokenPlugin extends Plugin {
    static getHelp() {
        return {
            name: "send-token TOKEN ADDRESS VALUE",
            help: "Send VALUE tokens (at TOKEN) to ADDRESS"
        };
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 3) {
                this.throwError("send-token requires exactly TOKEN, ADDRESS and VALUE");
            }
            if (this.accounts.length !== 1) {
                this.throwError("send-token requires exactly one account");
            }
            let tokenAddress = yield this.getAddress(args[0]);
            this.contract = new ethers.Contract(tokenAddress, Erc20Abi, this.accounts[0]);
            this.decimals = yield this.contract.decimals();
            this.toAddress = yield this.getAddress(args[1]);
            this.value = ethers.utils.parseUnits(args[2], this.decimals);
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                "To": this.toAddress,
                "Token Contract": this.contract.address,
                "Value": ethers.utils.formatUnits(this.value, this.decimals)
            };
            let namePromise = this.contract.name().then((name) => {
                if (name === "") {
                    throw new Error("returned zero");
                }
                info["Token Name"] = name;
            }, (error) => {
                let contract = new ethers.Contract(this.contract.address, Erc20AltAbi, this.contract.signer);
                contract.name().then((name) => {
                    info["Token Name"] = ethers.utils.parseBytes32String(name);
                }, (error) => {
                    throw error;
                });
            });
            let symbolPromise = this.contract.symbol().then((symbol) => {
                if (symbol === "") {
                    throw new Error("returned zero");
                }
                info["Token Symbol"] = symbol;
            }, (error) => {
                let contract = new ethers.Contract(this.contract.address, Erc20AltAbi, this.contract.signer);
                contract.symbol().then((symbol) => {
                    info["Token Symbol"] = ethers.utils.parseBytes32String(symbol);
                }, (error) => {
                    throw error;
                });
            });
            yield namePromise;
            yield symbolPromise;
            this.dump("Sending Tokens:", info);
            yield this.contract.transfer(this.toAddress, this.value);
        });
    }
}
cli.addPlugin("send-token", SendTokenPlugin);
class CompilePlugin extends Plugin {
    static getHelp() {
        return {
            name: "compile FILENAME",
            help: "Compiles a Solidity contract"
        };
    }
    static getOptionHelp() {
        return [
            {
                name: "[ --no-optimize ]",
                help: "Do not optimize the compiled output"
            },
            {
                name: "[ --warnings ]",
                help: "Error on any warning"
            }
        ];
    }
    prepareOptions(argParser) {
        const _super = Object.create(null, {
            prepareOptions: { get: () => super.prepareOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareOptions.call(this, argParser);
            this.noOptimize = argParser.consumeFlag("no-optimize");
            this.warnings = argParser.consumeFlag("warnings");
        });
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwError("compile requires exactly FILENAME");
            }
            this.filename = args[0];
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let source = fs.readFileSync(this.filename).toString();
            let result = compile(source, {
                filename: this.filename,
                optimize: (!this.noOptimize)
            });
            let output = {};
            result.forEach((contract, index) => {
                output[contract.name] = {
                    bytecode: contract.bytecode,
                    runtime: contract.runtime,
                    interface: contract.interface.fragments.map((f) => f.format(ethers.utils.FormatTypes.full))
                };
            });
            console.log(JSON.stringify(output, null, 4));
        });
    }
}
cli.addPlugin("compile", CompilePlugin);
class DeployPlugin extends Plugin {
    static getHelp() {
        return {
            name: "deploy FILENAME",
            help: "Compile and deploy a Solidity contract"
        };
    }
    static getOptionHelp() {
        return [
            {
                name: "[ --no-optimize ]",
                help: "Do not optimize the compiled output"
            },
            {
                name: "[ --contract NAME ]",
                help: "Specify the contract to deploy"
            }
        ];
    }
    prepareOptions(argParser) {
        const _super = Object.create(null, {
            prepareOptions: { get: () => super.prepareOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareOptions.call(this, argParser);
            if (this.accounts.length !== 1) {
                this.throwError("deploy requires exactly one account");
            }
            this.noOptimize = argParser.consumeFlag("no-optimize");
            this.contractName = argParser.consumeOption("contract");
        });
    }
    prepareArgs(args) {
        const _super = Object.create(null, {
            prepareArgs: { get: () => super.prepareArgs }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.prepareArgs.call(this, args);
            if (args.length !== 1) {
                this.throwError("deploy requires exactly FILENAME");
            }
            this.filename = args[0];
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let source = fs.readFileSync(this.filename).toString();
            let result = compile(source, {
                filename: this.filename,
                optimize: (!this.noOptimize)
            });
            let codes = result.filter((c) => (c.bytecode !== "0x" && (this.contractName == null || this.contractName == c.name)));
            if (codes.length > 1) {
                this.throwError("Please specify a contract with --contract NAME");
            }
            if (codes.length === 0) {
                this.throwError("No contract found");
            }
            let factory = new ethers.ContractFactory(codes[0].interface, codes[0].bytecode, this.accounts[0]);
            let contract = yield factory.deploy();
            dump("Deployed:", {
                Contract: codes[0].name,
                Address: contract.address,
                Bytecode: codes[0].bytecode,
                Interface: codes[0].interface.fragments.map((f) => f.format(ethers.utils.FormatTypes.full))
            });
        });
    }
}
cli.addPlugin("deploy", DeployPlugin);
cli.run(process.argv.slice(2));
