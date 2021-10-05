import sqlite3 from 'better-sqlite3';
import { ethers } from 'ethers';
import path from 'path';
import { loadLyraContractDeploymentBlock } from './parseFiles';
import { getLyraContract } from './transactions';
import * as console from "console";

const EVENT_BATCH_SIZE = 10000;

function createTableStatement(eventName: string, nameTypes: [string, string][]) {
  return `CREATE TABLE IF NOT EXISTS ${eventName} ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "blockNumber" INTEGER NOT NULL, ${nameTypes
    .map(x => `"${x[0]}" ${x[1]} NOT NULL`)
    .join(', ')});`;
}

function insertEventStatement(eventName: string, nameTypes: [string, string][]) {
  return `INSERT INTO ${eventName} ("blockNumber", ${nameTypes
    .map(x => `"${x[0]}"`)
    .join(', ')}) VALUES (?, ${nameTypes.map(_ => '?').join(', ')});`;
}

async function getAllEvents(
  contract: ethers.Contract,
  filter: ethers.EventFilter,
  startBlock: number,
  endBlock: number,
) {
  let eventBatch = [];
  let results: any[] = [];
  let current = startBlock;
  while (current < endBlock) {
    const toBlock = current + EVENT_BATCH_SIZE - 1;
    eventBatch.push(contract.queryFilter(filter, current, toBlock > endBlock ? endBlock : toBlock));
    if (eventBatch.length >= EVENT_BATCH_SIZE) {
      const res = await Promise.all(eventBatch);
      results = results.concat(...res);
      eventBatch = [];
    }
    current += EVENT_BATCH_SIZE;
  }
  if (eventBatch.length > 0) {
    const res = await Promise.all(eventBatch);
    results = results.concat(...res);
  }
  return results;
}

async function getAllNewEvents(
  db: any,
  contract: ethers.Contract,
  filter: ethers.EventFilter,
  eventName: string,
  nameTypes: [string, string][],
  startBlock: number,
  endBlock: number,
) {
  startBlock =
    (db.prepare(`SELECT MAX("blockNumber") as maxBlock FROM ${eventName}`).get()?.maxBlock || startBlock - 1) + 1;

  console.log(`-- Fetching all ${eventName} events from ${startBlock} to ${endBlock}`);
  const newResults = await getAllEvents(contract, filter, startBlock, endBlock);

  const statement = await db.prepare(insertEventStatement(eventName, nameTypes));
  for (const item of newResults) {
    statement.run(item.blockNumber, ...item.args.map((x: any) => x.toString()));
  }
}

export async function cacheAllEventsForLyraContract(
  deployment: string,
  contractName: string,
  endBlock: number,
  market?: string,
  eventFilter?: string[]
) {
  console.log(`- Caching events for ${contractName}`)
  const db = sqlite3(
    path.join(
      __dirname,
      '../../data/',
      `${deployment}-${(!market ? contractName : `${contractName}-${market}`)}.sqlite`,
    ),
  );

  const contract = await getLyraContract(deployment, contractName, market);
  const deploymentBlock = loadLyraContractDeploymentBlock(deployment, contractName, market);

  for (const event in contract.interface.events) {
    const eventData = contract.interface.events[event];
    if (!!eventFilter && !eventFilter.includes(eventData.name)) {
      continue;
    }

    const nameTypes: [string, string][] = eventData.inputs.map(x => [x.name, 'STRING']);

    const createTable = createTableStatement(eventData.name, nameTypes);
    await db.exec(createTable);

    const filter = contract.filters[event](...eventData.inputs.map(_ => null));
    await getAllNewEvents(db, contract, filter, eventData.name, nameTypes, deploymentBlock, endBlock);
  }
}

export async function getEventsFromLyraContract(
  deployment: string,
  contractName: string,
  eventName: string,
  filters: { startBlock?: number; endBlock?: number; args?: { [key: string]: any } },
  market?: string
) {
  const db = sqlite3(
    path.join(
      __dirname,
      '../../data/',
      `${deployment}-${(!market ? contractName : `${contractName}-${market}`)}.sqlite`,
    ),
  );

  const contract = await getLyraContract(deployment, contractName, market);
  const eventData = Object.values(contract.interface.events).find(x => x.name === eventName);
  if (!eventData) {
    throw Error(`No event ${eventName} for contract ${contractName}-${market}`);
  }

  return await db.prepare(`SELECT * FROM ${eventName}`).all();
}
