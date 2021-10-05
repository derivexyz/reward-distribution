import {cacheAllEventsForLyraContract, getEventsFromLyraContract} from "../../util/events";
import {getNetworkProvider} from "../../util";
import {ZERO_ADDRESS} from "../../util/web3utils";

const ignoreList = ['0xB6DACAE4eF97b4817d54df8e005269f509f803f9', ZERO_ADDRESS]


export async function getLyraLPRewards(deployment: string, roundMaxExpiryTimestamp: number, totalRewards: number, market: string) {
  const endBlock = (await (getNetworkProvider().getBlock('latest'))).number;
  await cacheAllEventsForLyraContract(deployment, 'LiquidityPool', endBlock, market, ['RoundStarted', 'RoundEnded']);
  await cacheAllEventsForLyraContract(deployment, 'LiquidityCertificate', endBlock, market, ['CertificateDataModified', 'Transfer']);

  const roundStartedEvents = await getEventsFromLyraContract(deployment, 'LiquidityPool', 'RoundStarted', {}, market);
  const roundEndedEvents = await getEventsFromLyraContract(deployment, 'LiquidityPool', 'RoundEnded', {}, market);
  const dataModifiedEvents = await getEventsFromLyraContract(deployment, 'LiquidityCertificate', 'CertificateDataModified', {}, market);
  const transferEvents = await getEventsFromLyraContract(deployment, 'LiquidityCertificate', 'Transfer', {}, market);

  // 1. get roundStarted event with maxExpiryTimestamp specified above - store block number
  const expiryToTokenValue: {[key:number]: number} = {}
  roundEndedEvents.forEach((x) => {
    expiryToTokenValue[x.maxExpiryTimestamp] = x.pricePerToken / 1e18
  })

  const roundStartedEvent = roundStartedEvents.find(x => {return (x.newMaxExpiryTimestamp || x.newMaxExpiryTimestmp) == roundMaxExpiryTimestamp});

  // 2. get all LC balances as at the round start block
  const certificates: {[key: number]: { value: number, owner: string, lastTransfer: number }} = {}

  for (const dataModifiedEvent of dataModifiedEvents) {
    if (dataModifiedEvent.blockNumber <= roundStartedEvent.blockNumber) {
      certificates[dataModifiedEvent.certificateId] = {
        value: dataModifiedEvent.liquidity / expiryToTokenValue[dataModifiedEvent.enteredAt] * expiryToTokenValue[roundStartedEvent.lastMaxExpiryTimestamp || roundStartedEvent.lastMaxExpiryTimestmp] / 1e18,
        owner: "",
        lastTransfer: 0
      };
    }
  }

  for (const transfer of transferEvents) {
    if (transfer.blockNumber > roundStartedEvent.blockNumber) {
      continue;
    }
    if (certificates[transfer.tokenId].lastTransfer < transfer.blockNumber) {
      certificates[transfer.tokenId].lastTransfer = transfer.blockNumber;
      certificates[transfer.tokenId].owner = transfer.to;
    }
  }

  // 3. calculate liquidity and rewards for all owners
  let totalValue = 0;
  let perOwner: {[key:string]: { totalLiquidity: number, totalReward: number, owned: string[] }} = {}
  for (const certificateId in certificates) {
    const certificate = certificates[certificateId];
    if (ignoreList.includes(certificate.owner)) {
      continue;
    }
    totalValue += certificate.value;
    if (!perOwner[certificate.owner]) {
      perOwner[certificate.owner] = {
        totalReward: 0,
        totalLiquidity: 0,
        owned: []
      }
    }
    perOwner[certificate.owner].totalLiquidity += certificate.value;
    perOwner[certificate.owner].owned.push(certificateId);
  }

  let count = 0;
  let total = 0;
  let result: any = {};
  for (const owner in perOwner) {
    perOwner[owner].totalReward = perOwner[owner].totalLiquidity * totalRewards / totalValue;
    if (perOwner[owner].totalReward > 0) {
      // console.log(owner, perOwner[owner].totalReward);
      count += 1;
      total += perOwner[owner].totalReward;
      result[owner] = perOwner[owner].totalReward;
    }
  }
  console.log({count, total});
  console.log();

  return result;
}