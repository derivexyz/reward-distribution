import {getRounds} from "./getRounds";
import {getAllUniEvents} from "./getAndCacheUniswapEvents";

enum NotEarningReason {
  IsEarning,
  LiquidityChanged,
  Transferred,
  Minted,
  Burnt,
  LiquidityAtZero
}


async function main() {
  console.log("Caching block number up to latest, and get round timestamps and block numbers");
  let snapshotBlocks = await getRounds();

  const [mints, transfers, increaseEvents, decreaseEvents] = await getAllUniEvents()

  // Ensure no duplicate transfer at same block number - manually handle if it is an issue
  // Only one example on a different pool...
  const seen: {[key: number]: any} = {};
  for (const transfer of transfers) {
    if (!!seen[transfer.blockNumber] && seen[transfer.blockNumber].tokenId !== transfer.tokenId) {
      console.log("DUPLICATE TRANSFER", transfer, seen[transfer.blockNumber]);
    }
    seen[transfer.blockNumber] = transfer;
  }

  const mintBlockNumbers = mints.map((x: any) => x.blockNumber);
  const mintTransfers = transfers.filter((x: any) => mintBlockNumbers.includes(x.blockNumber));
  const tokenIds = mintTransfers.map((x: any) => x.tokenId);

  const tokens: {[key:number]: any} = {};
  for (const tokenId of tokenIds) {
    const tokenTransfers = transfers.filter((x: any) => x.tokenId === tokenId);

    const mintTransfer = tokenTransfers.find((x: any) => x.tokenId === tokenId);
    const mint = mints.find((x:any) => x.blockNumber === mintTransfer.blockNumber);

    const mintIncreases = increaseEvents.filter((x: any) => x.tokenId === tokenId).map((x: any) => {return {...x, sign: 1}});
    const mintDecreases = decreaseEvents.filter((x: any) => x.tokenId === tokenId).map((x: any) => {return {...x, sign: -1}});
    const liquidityChanges = mintIncreases.concat(...mintDecreases);
    liquidityChanges.sort((x:any, y:any) => x.blockNumber > y.blockNumber)

    tokens[tokenId] = {
      id: tokenId,
      createdBlock: tokenTransfers[0].blockNumber,
      liquidityChanges: liquidityChanges,
      transfers: tokenTransfers,
      tickLower: mint.tickLower,
      tickUpper: mint.tickUpper
    }
  }

  const results: { [snapId: string]: {
    totalLiquidity: number,
    perToken: { [tokenId: string]: {
      isEarning: boolean,
      isPending: boolean,
      inRange: boolean,
      notEarningReason: NotEarningReason,
      owner: string,
      tokenLiquidity: number,
    } }
  } } = {};

  const perUserData: any = {}
  const totalLyra = 375000;
  const lyraPerEpoch = totalLyra / 112;
  let lastPeriod;
  let secondLastPeriod;

  console.log("computing")
  for (const i of snapshotBlocks) {
    const startSnap = i[0][0];
    const endSnap = i[1][0];

    const resId = `${startSnap}-${endSnap}`;
    secondLastPeriod = lastPeriod;
    lastPeriod = resId;
    results[resId] = {
      totalLiquidity: 0,
      perToken: {}
    };

    for (const tokenId in tokens) {
      const token = tokens[tokenId];

      let isEarning = true;
      let isPending = false;
      let inRange = true;
      let notEarningReason = NotEarningReason.IsEarning;

      let lastTransfer: any = {blockNumber: 0};

      for (const transfer of token.transfers) {
        if (!!endSnap && transfer.blockNumber > endSnap) {
          // Ignore any transfers that happened after the period
          continue;
        }
        if (transfer.blockNumber > lastTransfer.blockNumber) {
          lastTransfer = transfer;
        }
      }

      if (lastTransfer.blockNumber === 0) {
        // Token doesn't exist yet
        continue;
      }
      const ownerAtEnd = lastTransfer.toAddr;


      if (lastTransfer.blockNumber > startSnap) {
        // does not get a reward for period, so skip rest of calculation
        isEarning = false;
        notEarningReason = NotEarningReason.Transferred;
        if (lastTransfer.fromAddr === "0x0000000000000000000000000000000000000000") {
          notEarningReason = NotEarningReason.Minted;
        }
        if (lastTransfer.toAddr === "0x0000000000000000000000000000000000000000") {
          notEarningReason = NotEarningReason.Burnt;
        }
      }

      // Get the token's liquidity by summing all liquidity change events
      let tokenLiquidity = 0;
      for (const liquidityChange of token.liquidityChanges) {
        if (!!endSnap && liquidityChange.blockNumber > endSnap) {
          continue;
        }
        if (liquidityChange.blockNumber > startSnap) {
          isEarning = false;
          if (notEarningReason == NotEarningReason.IsEarning) {
            notEarningReason = NotEarningReason.LiquidityChanged;
          }
        }
        tokenLiquidity += liquidityChange.liquidity / 1e18 * liquidityChange.sign;
      }

      // We ignore any liquidity that is not in the specified range
      if (token.tickLower != -100 || token.tickUpper != 2620) {
        isEarning = false;
        inRange = false;
      }

      // Ignore any values less than 1 gwei worth of liquidity (dust)
      if (tokenLiquidity < 0.000000001) {
        isEarning = false;
        notEarningReason = NotEarningReason.LiquidityAtZero
      }

      // If we are in the current round, don't calculate the share yet
      if (endSnap == null) {
        isPending = true;
      }

      if (!isEarning || isPending || !inRange) {
        results[resId].perToken[tokenId] = {
          isEarning,
          isPending,
          inRange,
          notEarningReason,
          owner: ownerAtEnd,
          tokenLiquidity,
        }
        continue;
      }

      results[resId].totalLiquidity += tokenLiquidity;
      results[resId].perToken[tokenId] = {
        isEarning,
        isPending,
        inRange,
        notEarningReason,
        owner: ownerAtEnd,
        tokenLiquidity,
      }
    }

    // now allocate the lyra tokens given we have the total liquidity
    for (const tokenId in results[resId].perToken) {
      const tokenInfo = results[resId].perToken[tokenId];
      const owner = tokenInfo.owner;
      if (!perUserData[owner]) {
        perUserData[owner] = {
          totalAmount: 0,
          periods: {}
        }
      }
      if (!perUserData[owner].periods[resId]) {
        perUserData[owner].periods[resId] = {
          totalEarningLiquidity: 0,
          totalLiquidity: 0,
          totalShare: 0,
          totalRewardForPeriod: 0,
          positions: []
        }
      }

      if (tokenInfo.isEarning && !tokenInfo.isPending) {
        const amountTokens = lyraPerEpoch * tokenInfo.tokenLiquidity / results[resId].totalLiquidity;
        perUserData[owner].totalAmount += amountTokens
        perUserData[owner].periods[resId].totalRewardForPeriod += amountTokens;
        perUserData[owner].periods[resId].totalEarningLiquidity += tokenInfo.tokenLiquidity;
        perUserData[owner].periods[resId].totalShare += tokenInfo.tokenLiquidity / results[resId].totalLiquidity;
      }

      perUserData[owner].periods[resId].totalLiquidity += tokenInfo.tokenLiquidity
      perUserData[owner].periods[resId].positions.push({
        id: tokenId,
        liquidity: tokenInfo.tokenLiquidity,
        currentShare: tokenInfo.isEarning ? tokenInfo.tokenLiquidity / results[resId].totalLiquidity : 0,
        rewardsForPeriod: tokenInfo.isEarning ? lyraPerEpoch * tokenInfo.tokenLiquidity / results[resId].totalLiquidity : 0,
        isEarning: tokenInfo.isEarning,
        inRange: tokenInfo.inRange,
        isPending: tokenInfo.isPending,
        notEarningReason: tokenInfo.notEarningReason
      })
    }
  }
  console.log("data collected");
  for (const i in perUserData) {
    console.log(`${i} receives ${perUserData[i].totalAmount} Lyra`)
  }
  // To get the info about an individual user:
  // console.log(perUserData['0x12345...'])
}

main().then(() => console.log("\nDone"));
