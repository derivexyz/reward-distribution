import { Provider } from '@ethersproject/providers';
import { ethers } from 'ethers';

export function getNetworkProvider(): Provider {
  return new ethers.providers.JsonRpcProvider('https://mainnet.optimism.io');
}
