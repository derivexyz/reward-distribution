import { Contract } from 'ethers';
import { getNetworkProvider} from './index';
import { loadLyraContractData } from './parseFiles';

const contracts: any = {};

export async function getLyraContract(deployment: string, contractName: string, market?: string): Promise<Contract> {
  if (!contracts[deployment]) {
    contracts[deployment] = {
      markets: {}
    }
  }

  if (!!market && !contracts[deployment].markets[market]) {
    contracts[deployment].markets[market] = {}
  }

  if (!!market && contracts[deployment].markets[market][contractName]) {
    return contracts[deployment].markets[market][contractName];
  }

  if (contracts[deployment][contractName]) {
    return contracts[deployment][contractName];
  }

  const data = loadLyraContractData(deployment, contractName, market);

  const contract = new Contract(
    data.target.address,
    data.source.abi,
    getNetworkProvider(),
  );
  if (market) {
    contracts[deployment].markets[market][contractName] = contract;
  } else {
    contracts[deployment][contractName] = contract;
  }

  return contract;
}
