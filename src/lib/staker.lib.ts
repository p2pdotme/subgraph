import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CircleStakeRecords,
  CircleUnstakeRecords,
  Staker,
} from "../../generated/schema";
import { UNSTAKE_REQUEST_RAISED } from "../constants";

export function loadStaker(key: Address, event: ethereum.Event): Staker {
  let staker = Staker.load(key);

  if (!staker) {
    staker = new Staker(key);
    staker.staker = key.toHexString();
    staker.totalStaked = BigInt.fromI32(0);
    staker.circleStakeRecords = [];
    staker.circleUnstakeRecords = [];
  }

  staker.blockNumber = event.block.number;
  staker.blockTimestamp = event.block.timestamp;
  staker.transactionHash = event.transaction.hash;

  return staker;
}

export function loadCircleStakeRecords(
  key: Bytes,
  event: ethereum.Event,
): CircleStakeRecords {
  let circleStakeRecord = CircleStakeRecords.load(key);

  if (!circleStakeRecord) {
    circleStakeRecord = new CircleStakeRecords(key);
    circleStakeRecord.circle = Bytes.fromI32(0);
    circleStakeRecord.staker = Bytes.fromI32(0);
    circleStakeRecord.amount = BigInt.fromI32(0);
    circleStakeRecord.stakedAt = BigInt.fromI32(0);
  }

  circleStakeRecord.blockNumber = event.block.number;
  circleStakeRecord.blockTimestamp = event.block.timestamp;
  circleStakeRecord.transactionHash = event.transaction.hash;

  return circleStakeRecord;
}

export function loadCircleUnstakeRecords(
  key: Bytes,
  event: ethereum.Event,
): CircleUnstakeRecords {
  let circleUnstakeRecord = CircleUnstakeRecords.load(key);

  if (!circleUnstakeRecord) {
    circleUnstakeRecord = new CircleUnstakeRecords(key);
    circleUnstakeRecord.amount = BigInt.fromI32(0);
    circleUnstakeRecord.availableAt = BigInt.fromI32(0);
    circleUnstakeRecord.status = BigInt.fromI32(UNSTAKE_REQUEST_RAISED);
  }

  circleUnstakeRecord.blockNumber = event.block.number;
  circleUnstakeRecord.blockTimestamp = event.block.timestamp;
  circleUnstakeRecord.transactionHash = event.transaction.hash;

  return circleUnstakeRecord;
}
