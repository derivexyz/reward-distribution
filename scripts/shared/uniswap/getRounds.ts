// @ts-ignore:next-line
import sqlite3 from 'better-sqlite3'
import axios from "axios";

const endpoint = "https://api.thegraph.com/subgraphs/name/ianlapham/optimism-blocks";


async function getBlockTimestamp(blockNumber: number | 'latest'): Promise<[number, number] | null> {
  let res;
  if (!process.env.OVM_RPC_URL) {
    throw new Error("process.env.OVM_RPC_URL is undefined")
  }
  while (true) {
    try {
      res = await axios.post(process.env.OVM_RPC_URL,
        {
          "jsonrpc": "2.0",
          "method": "eth_getBlockByNumber",
          "params": [blockNumber == 'latest' ? 'latest' : '0x' + blockNumber.toString(16), false],
          "id": 1
        });
      break;
    } catch {
      console.log("fail")
    }
  }
  if (res.data.result) {
    return [parseInt(res.data.result.number, 16), parseInt(res.data.result.timestamp, 16)];
  } else {
    return null;
  }
}

async function getBlocksFast(db: any) {
  const maxBlock = await getBlockTimestamp('latest' as any);

  await db.exec(`CREATE TABLE IF NOT EXISTS blockNums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blockNumber INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    )`);

  const insertStmt = db.prepare('INSERT INTO blockNums (blockNumber, timestamp) VALUES (?, ?)');
  const insertMany = db.transaction((blockNums: any) => {
    for (const blockNum of blockNums) {
      insertStmt.run(blockNum.number, blockNum.timestamp);
    }
  });

  let current: number = ((db.prepare("SELECT MAX(blockNumber) as maxBlock FROM blockNums").get())?.maxBlock || 0) + 1;
  const limit = 1000;
  while (true) {
    console.log(`- Caching block timestamps: [${current}-${current+1000}]`)
    const res = await axios.post(endpoint, {
      query: `{
        blocks(first: ${limit}, where:{number_gte:${current}}, orderBy: number) {
          number
          timestamp
        }
      }`
    })
    current += limit;
    insertMany(res.data.data.blocks)
    if (res.data.data.blocks.length < 1000) {
      break;
    }
  }
}


async function cacheBlockNumbers(db: any) {
  await db.exec(`CREATE TABLE IF NOT EXISTS blockNums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    timestamp INTEGER NOT NULL
  )`);

  const insertStmt = db.prepare('INSERT INTO blockNums (blockNumber, timestamp) VALUES (?, ?)');
  const insertMany = db.transaction((blockNums: any) => {
    for (const blockNum of blockNums) {
      insertStmt.run(blockNum[0], blockNum[1]);
    }
  });

  const startBlock: number = ((db.prepare("SELECT MAX(blockNumber) as maxBlock FROM blockNums").get())?.maxBlock || 0) + 1;
  const maxBlock = await getBlockTimestamp('latest' as any);
  console.log(`- Caching block timestamps: [${startBlock}-${maxBlock}]`)

  if (!maxBlock) {
    throw Error("")
  }
  const endBlock = maxBlock[0];
  const batchSize = 200;

  for (let i = startBlock; i < endBlock; i+= batchSize) {
    console.log(`- ${i}/${endBlock}`)
    const promises = [];
    for (let j=i; j<i+batchSize; j++) {
      promises.push(getBlockTimestamp(j));
    }
    const results = await Promise.all(promises);
    insertMany(results.filter(x => x !== null));
  }
}

export async function getRounds(startDate: number, endDate: number, epochDuration: number) {
  let blocksDB = sqlite3('./data/blockNumbers.sqlite');

  // await cacheBlockNumbers(blocksDB);
  await getBlocksFast(blocksDB);

  const epochs = [];

  let currentTimestamp = startDate;

  let res = (blocksDB.prepare("SELECT MIN(blockNumber) as minBlock, timestamp FROM blockNums WHERE timestamp > ?").get(currentTimestamp))
  let currentBlock = res.minBlock;
  let currentRealTimestamp = res.timestamp;

  while (currentTimestamp < endDate) {
    const nextTimestamp = currentTimestamp + epochDuration;

    res = (blocksDB.prepare("SELECT MIN(blockNumber) as minBlock, timestamp FROM blockNums WHERE timestamp > ?").get(nextTimestamp))

    if (res.minBlock === null) {
      epochs.push([[currentBlock, currentRealTimestamp], [null, nextTimestamp]])
      break;
    }

    epochs.push([[currentBlock, currentRealTimestamp], [res.minBlock - 1, res.timestamp]])

    currentTimestamp = nextTimestamp;
    currentBlock = res.minBlock;
    currentRealTimestamp = res.timestamp;
  }

  blocksDB.close();

  return epochs;
}
