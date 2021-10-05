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

    for (const leap in all[type]) {
      if (leapFilter && leap != leapFilter) {
        continue;
      }
      if (type == 'lyra') {
        for (const market in all[type][leap]) {
          if (marketFilter && market != marketFilter) {
            continue;
          }

          // Get Lyra Option market rewards
          const toCheck = all[type][leap][market];
          console.log(`Getting ${type} ${market} pool rewards for ${leap}`)
          const lyraRewards = await getLyraLPRewards(toCheck.deployment, toCheck.roundMaxExpiryTimestamp, toCheck.lyraRewards, market);
          for (const owner in lyraRewards) {
            if (!totals[owner]) {
              totals[owner] = 0;
            }
            totals[owner] += lyraRewards[owner]
          }
        }
      } else {
        // Get Uniswap pool rewards
        const toCheck = all[type][leap];
        console.log(`Getting ${type} pool rewards for ${leap}`)
        const uniRewards = await getUniLPRewards(toCheck.startDate, toCheck.endDate, toCheck.epochDuration, toCheck.minTick, toCheck.maxTick, toCheck.lyraRewards);
        for (const owner in uniRewards) {
          if (!totals[owner]) {
            totals[owner] = 0;
          }
          totals[owner] += uniRewards[owner]
        }
      }
    }
  }

  for (const owner in totals) {
    console.log(`${owner} ${totals[owner]}`);
  }
}

main(process.argv).then(() => console.log("\nDone"));
