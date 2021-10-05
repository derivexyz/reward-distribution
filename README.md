# Reward distribution

Collection of scripts to help compute reward distributions.

Before running anything, you must install all dependencies.
```
yarn install
```

## LEAP-3

https://leaps.lyra.finance/leaps/leap-3/

### Uniswap LP reward script

To run the uniswap LP reward script:

```
yarn leap3:uni
```

### Method

Rewards are computed in 3 hour rounds by taking a snapshot at the first block past every 3hr mark from the starting snapshot. The starting block is the first block after the 13th Sept 00:00 UTC, the second is the first block after 03:00 UTC, and so on. The last snapshot will be the first block after 27 September 00:00 UTC. This means that the time between snapshots can vary, however the rewards will remain constant. Rewards per 3hr “round” will be 3348.2 lyra (37500 lyra / 112 rounds total).

To determine who is eligible for the rewards, we look at events from both the uniswap pool for sUSD/DAI at the 0.05% fee rate (0xa14e5b3ba5dd981b536e0950390b03972b795018) and the uniswap NonfungiblePositionManager contract (0xc36442b4a4522e871399cd717abdd847ab11fe88).

It is important to note that liquidity must be provided via the NonfungiblePositionManager contract, we will ignore any liquidity that is added directly to the pool contract.

We use the uniswap NFT contract `Transfer` events to determine the final location for who owns the funds. These events are shared by all pools, so to filter by the liquidity pool that we want, we match blockNumbers of pool contract `Mint` events to the NFT `Transfer` events. Additionally we use the NFT contract `IncreaseLiquidity` and `DecreaseLiquidity` events to determine the liquidity for a given NFT.

To compute the rewards per NFT; we compute the share each NFT is owed per round. NFTs are excluded from the rewards for the round if any of the following are true:
minTick != -100
maxTick != 2620
They have been transferred/minted/burned in that round
They have increased/decreased liquidity in that round

The total liquidity of all NFTs that pass the above checks is computed, and then the rewards for that round are distributed based on each individual NFT’s liquidity in that round (i.e. an NFT with more liquidity will get a proportionally larger share).


### Lyra LP reward script

To run the lyra option market LP reward script:

```
yarn leap3:lyra-ETH
```

## LEAP-4

https://leaps.lyra.finance/leaps/leap-4/

```
yarn leap4:uni
```


## LEAP-6

https://leaps.lyra.finance/leaps/leap-6/

```
yarn leap6:ETH
yarn leap6:LINK
```


### Method

As above, just with different start/end times as well as different tick ranges, as specified in the LEAP.