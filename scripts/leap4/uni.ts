import {getUniLPRewards} from "../shared/uniswap/getUniLPRewards";


async function main() {
  const startDate = 1632700800;
  const epochDuration = 60 * 60 * 3; // 3hrs
  const endDate = 1633305600;
  const minTick = -2230;
  const maxTick = 1820;
  const lyraRewards = 150000;

  await getUniLPRewards(startDate, endDate, epochDuration, minTick, maxTick, lyraRewards);
}

main().then(() => console.log("\nDone"));
