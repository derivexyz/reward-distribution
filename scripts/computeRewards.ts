import {getLyraLPRewards} from "./shared/lyra/getLyraLPRewards";
import {getUniLPRewards} from "./shared/uniswap/getUniLPRewards";
import console from "console";
import chalk from "chalk";


function getArg(args: string[], flag: string): string | undefined {
  let result;
  args.forEach((x, i, a) => {
    if (x == flag) {
      if (i + 1 < a.length) {
        result = a[i + 1];
      }
    }
  })
  return result;
}



async function main(args: string[]) {
  const typeFilter = getArg(args, "--type");
  const leapFilter = getArg(args, "--leap");
  const marketFilter = getArg(args, "--market");
  const addressFilter = getArg(args, "--address");

  console.log({typeFilter, leapFilter, marketFilter});

  let totals: any = {};

  let all = require(__dirname + "/leaps.json");

  for (const type in all) {
    if (typeFilter && type != typeFilter) {
      continue;
    }

    for (const market in all[type]) {
      if (marketFilter && market != marketFilter) {
        continue;
      }

      for (const distribution of all[type][market]) {
        if (leapFilter && distribution.leap != leapFilter) {
          continue;
        }
        console.log(chalk.cyan(`\nGetting ${type} ${market} pool rewards for ${distribution.leap}`));

        let rewards;
        if (type == 'lyra') {
          rewards = await getLyraLPRewards(distribution.deployment, distribution.roundMaxExpiryTimestamp, distribution.lyraRewards, market);
        } else {
          rewards = await getUniLPRewards(distribution.startDate, distribution.endDate, distribution.epochDuration, distribution.minTick, distribution.maxTick, distribution.lyraRewards);
        }

        for (const owner in rewards) {
          if (!totals[owner.toLowerCase()]) {
            totals[owner.toLowerCase()] = 0;
          }
          totals[owner.toLowerCase()] += rewards[owner]
        }
      }
    }
  }

  if (!!addressFilter) {
    console.log(`${addressFilter} ${totals[addressFilter.toLowerCase()] || 0}`);
  } else {
    for (const owner in totals) {
      console.log(`${owner} ${totals[owner]}`);
    }
  }
}

main(process.argv).then(() => console.log("\nDone"));
