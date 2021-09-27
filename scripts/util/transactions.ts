import { Contract } from 'ethers';
import { getNetworkProvider} from './index';
import { loadLyraContractData } from './parseFiles';

const contracts: any = {};

export async function getLyraContract(contractName: string, market?: string): Promise<Contract> {
  if (!!market && !!contracts.markets && !!contracts.markets[market] && !!contracts.markets[market][contractName]) {
    return contracts.markets[market][contractName];
  }
  if (contracts[contractName]) {
    return contracts[contractName];
  }

  const data = loadLyraContractData(contractName, market);

  const contract = new Contract(
    data.target.address,
    data.source.abi,
    getNetworkProvider(),
  );
  if (market) {
    if (!contracts.markets) {
      contracts.markets = {};
    }
    if (!contracts.markets[market]) {
      contracts.markets[market] = {};
    }
    contracts.markets[market][contractName] = contract;
  } else {
    contracts[contractName] = contract;
  }

  return contract;
}
