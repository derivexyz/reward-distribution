import {getLyraLPRewards} from "./shared/lyra/getLyraLPRewards";
import {getUniLPRewards} from "./shared/uniswap/getUniLPRewards";


function getArg(args: string[], flag: string) {
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

      for (const leap in all[type][market]) {
        if (leapFilter && leap != leapFilter) {
          continue;
        }
        console.log(`Getting ${type} ${market} pool rewards for ${leap}`)

        const toCheck = all[type][market][leap];
        let rewards;
        if (type == 'lyra') {
          rewards = await getLyraLPRewards(toCheck.deployment, toCheck.roundMaxExpiryTimestamp, toCheck.lyraRewards, market);
        } else {
          rewards = await getUniLPRewards(toCheck.startDate, toCheck.endDate, toCheck.epochDuration, toCheck.minTick, toCheck.maxTick, toCheck.lyraRewards);
        }

        for (const owner in rewards) {
          if (!totals[owner]) {
            totals[owner] = 0;
          }
          totals[owner] += rewards[owner]
        }
      }
    }
  }

  for (const owner in totals) {
    console.log(`${owner} ${totals[owner]}`);
  }
}

main(process.argv).then(() => console.log("\nDone"));
