import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CircleStakeRecords,
  Staker,
} from "../../generated/schema";

export function loadStaker(key: Address, event: ethereum.Event): Staker {
  let staker = Staker.load(key);

  if (!staker) {
    staker = new Staker(key);
    staker.staker = key.toHexString();
    staker.totalStaked = BigInt.fromI32(0);
    staker.circleStakeRecords = [];
  }

  staker.blockNumber = event.block.number;
  staker.blockTimestamp = event.block.timestamp;
  staker.transactionHash = event.transaction.hash;

  return staker;
}

export function loadCircleStakeRecords(
  key: Bytes,
  event: ethereum.Event
): CircleStakeRecords {
  let circleStakeRecord = CircleStakeRecords.load(key);

  if (!circleStakeRecord) {
    circleStakeRecord = new CircleStakeRecords(key);
    circleStakeRecord.amount = BigInt.fromI32(0);
  }

  circleStakeRecord.blockNumber = event.block.number;
  circleStakeRecord.blockTimestamp = event.block.timestamp;
  circleStakeRecord.transactionHash = event.transaction.hash;

  return circleStakeRecord;
}

