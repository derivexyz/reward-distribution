import { ethers } from "ethers";
// @ts-ignore
import {abi as uniNFTAbi} from "../../contract-abis/NonfungiblePositionManager.json";
// @ts-ignore
import { abi as IUniswapV3PoolABI } from "../../contract-abis/IUniswapV3Pool.json";
import * as sqlite3 from 'better-sqlite3'

let db = sqlite3('./leap3/data/transactions.sqlite');

async function initialiseDBTables() {
  await db.exec(`CREATE TABLE IF NOT EXISTS nftTransfer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tokenId STRING NOT NULL,
    fromAddr STRING NOT NULL,
    toAddr STRING NOT NULL
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS nftIncreaseLiquidity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tokenId STRING NOT NULL,
    liquidity STRING NOT NULL
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS nftDecreaseLiquidity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tokenId STRING NOT NULL,
    liquidity STRING NOT NULL
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS poolMints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tickLower INTEGER NOT NULL,
    tickUpper INTEGER NOT NULL
  )`);
}


const provider = new ethers.providers.JsonRpcProvider("https://mainnet.optimism.io");

const poolContract = new ethers.Contract(
  "0xa14e5b3ba5dd981b536e0950390b03972b795018",
  IUniswapV3PoolABI,
  provider
);

const uniNftContract = new ethers.Contract(
  "0xc36442b4a4522e871399cd717abdd847ab11fe88",
  uniNFTAbi,
  provider
);

// The block when the pool contract was created
const startBlock = 34860;
// The amount of 10000 event batches to get at once
const eventBatchSize = 10;

async function getAllEvents(contract: ethers.Contract, filter: ethers.EventFilter, startBlock: number, endBlock: number) {
  let eventBatch = [];
  let results: any[] = [];
  let current = startBlock;
  while (current < endBlock) {
    const toBlock = current + 9999;
    eventBatch.push(contract.queryFilter(filter, current, toBlock > endBlock ? endBlock : toBlock));
    if (eventBatch.length >= eventBatchSize) {
      let res = await Promise.all(eventBatch);
      results = results.concat(...res);
      eventBatch = []
    }
    current += 10000;
  }
  if (eventBatch.length > 0) {
    let res = await Promise.all(eventBatch);
    results = results.concat(...res);
  }
  return results;
}


async function getAllNftTransfers(startBlock: number, endBlock: number) {
  console.log(`Fetching all nft transfers between ${startBlock} and ${endBlock}`);

  let results = await db.prepare("SELECT * FROM nftTransfer ORDER BY blockNumber").all();
  startBlock = results[results.length - 1]?.blockNumber + 1 || startBlock;

  console.log(`Fetching new events from ${startBlock} to ${endBlock}`);
  const newResults = await getAllEvents(uniNftContract, uniNftContract.filters.Transfer(null, null, null), startBlock, endBlock);

  const statement = await db.prepare("INSERT INTO nftTransfer (blockNumber, tokenId, fromAddr, toAddr) VALUES (?, ?, ?, ?)");
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tokenId.toString(), item.args.from, item.args.to)
    results.push({
      blockNumber: item.blockNumber,
      tokenId: item.args.tokenId.toString(),
      fromAddr: item.args.from,
      toAddr: item.args.to
    })
  }
  return results;
}

async function getAllNftIncreaseLiquidity(startBlock: number, endBlock: number) {
  console.log(`Fetching all nft increase liquidity between ${startBlock} and ${endBlock}`);

  let results = await db.prepare("SELECT * FROM nftIncreaseLiquidity ORDER BY blockNumber").all();
  startBlock = results[results.length - 1]?.blockNumber + 1 || startBlock;

  console.log(`Fetching new events from ${startBlock} to ${endBlock}`);
  const newResults = await getAllEvents(uniNftContract, uniNftContract.filters.IncreaseLiquidity(null, null, null, null), startBlock, endBlock);

  const statement = await db.prepare("INSERT INTO nftIncreaseLiquidity (blockNumber, tokenId, liquidity) VALUES (?, ?, ?)");
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tokenId.toString(), item.args.liquidity.toString())
    results.push({
      blockNumber: item.blockNumber,
      tokenId: item.args.tokenId.toString(),
      liquidity: item.args.liquidity.toString()
    })
  }
  return results;
}

async function getAllNftDecreaseLiquidity(startBlock: number, endBlock: number) {
  console.log(`Fetching all nft decrease liquidity between ${startBlock} and ${endBlock}`);

  let results = await db.prepare("SELECT * FROM nftDecreaseLiquidity ORDER BY blockNumber").all();
  startBlock = results[results.length - 1]?.blockNumber + 1 || startBlock;

  console.log(`Fetching new events from ${startBlock} to ${endBlock}`);
  const newResults = await getAllEvents(uniNftContract, uniNftContract.filters.DecreaseLiquidity(null, null, null, null), startBlock, endBlock);

  const statement = await db.prepare("INSERT INTO nftDecreaseLiquidity (blockNumber, tokenId, liquidity) VALUES (?, ?, ?)");
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tokenId.toString(), item.args.liquidity.toString())
    results.push({
      blockNumber: item.blockNumber,
      tokenId: item.args.tokenId.toString(),
      liquidity: item.args.liquidity.toString()
    })
  }
  return results;
}

async function getAllMints(startBlock: number, endBlock: number) {
  console.log(`Fetching all pool mints between ${startBlock} and ${endBlock}`);

  let results = await db.prepare("SELECT * FROM poolMints ORDER BY blockNumber").all();
  startBlock = results[results.length - 1]?.blockNumber + 1 || startBlock;

  console.log(`Fetching new events from ${startBlock} to ${endBlock}`);
  const newResults = await getAllEvents(poolContract, poolContract.filters.Mint(null, null, null, null, null, null, null), startBlock, endBlock);

  const statement = await db.prepare("INSERT INTO poolMints (blockNumber, tickLower, tickUpper) VALUES (?, ?, ?)");
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tickLower.toString(), item.args.tickUpper.toString())
    results.push({
      blockNumber: item.blockNumber,
      tickLower: item.args.tickLower.toString(),
      tickUpper: item.args.tickUpper.toString(),
    })
  }
  return results;
}


export async function getAllUniEvents() {
  await initialiseDBTables();

  const endBlock = (await provider.getBlock('latest')).number;

  const mints = await getAllMints(startBlock, endBlock);
  const transfers = await getAllNftTransfers(startBlock, endBlock);
  const increaseEvents = await getAllNftIncreaseLiquidity(startBlock, endBlock)
  const decreaseEvents = await getAllNftDecreaseLiquidity(startBlock, endBlock)

  return [mints, transfers, increaseEvents, decreaseEvents];
}