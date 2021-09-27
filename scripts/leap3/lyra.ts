import {getLyraLPRewards} from "../shared/lyra/getLyraLPRewards";


async function main() {
  const roundMaxExpiryTimestamp = 1633075200
  const lyraRewards = 375000;

  await getLyraLPRewards(roundMaxExpiryTimestamp, lyraRewards, 'sETH');
}

main().then(() => console.log("\nDone"));
