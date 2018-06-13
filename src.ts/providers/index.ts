'use strict';

import { Provider } from './provider';

import { Network } from './networks';

import { EtherscanProvider } from './etherscan-provider';
import { FallbackProvider } from './fallback-provider';
//import { IpcProvider } from './ipc-provider';
import { InfuraProvider } from './infura-provider';
import { JsonRpcProvider } from './json-rpc-provider';
import { Web3Provider } from './web3-provider';

function getDefaultProvider(network?: Network | string): FallbackProvider {
    return new FallbackProvider([
        new InfuraProvider(network),
        new EtherscanProvider(network),
    ]);
}

export {
    Provider,
    getDefaultProvider,

    FallbackProvider,

    EtherscanProvider,
    InfuraProvider,
    JsonRpcProvider,
    Web3Provider,
};
/*
var exports = {
    EtherscanProvider: EtherscanProvider,
    FallbackProvider: FallbackProvider,
    InfuraProvider: InfuraProvider,
    JsonRpcProvider: JsonRpcProvider,
    Web3Provider: Web3Provider,

    isProvider: Provider.isProvider,

    networks: Provider.networks,


    Provider: Provider,
}
*/
// Only available in node, so we do not include it in browsers
/*
if (IpcProvider) {
    exports.IpcProvider = IpcProvider;
}
*/
//module.exports = exports;
