import {getUniLPRewards} from "../shared/uniswap/getUniLPRewards";


async function main() {
  const startDate = 1631491200;
  const epochDuration = 60 * 60 * 3; // 3hrs
  const endDate = 1632700800;
  const minTick = -100;
  const maxTick = 2620;
  const lyraRewards = 375000;

  await getUniLPRewards(startDate, endDate, epochDuration, minTick, maxTick, lyraRewards);
}

main().then(() => console.log("\nDone"));
