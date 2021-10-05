/* tslint:disable */
/* eslint-disable */
import path from 'path';

export function loadLyraContractData(deployment: string, name: string, market?: string) {
  const filePath = path.join(__dirname, '../../deployments', deployment, 'lyra.json');
  const data = require(filePath);
  try {
    if (market) {
      return {
        target: data.targets.markets[market][name],
        source: data.sources[data.targets.markets[market][name].source],
      };
    }
    return {
      target: data.targets[name],
      source: data.sources[data.targets[name].source],
    };
  } catch (e) {
    console.log({ filePath, name, market });
    throw e;
  }
}

export function loadLyraContractDeploymentBlock(deployment: string, name: string, market?: string) {
  const filePath = path.join(__dirname, '../../deployments', deployment, 'lyra.json');
  const data = require(filePath);
  try {
    if (market) {
      return data.targets.markets[market][name].blockNumber;
    }
    return data.targets[name].blockNumber;
  } catch (e) {
    console.log({ filePath, name, market });
    throw e;
  }
}

/* tslint:enable */
/* eslint-enable */
