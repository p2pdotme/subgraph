import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CircleUsdcStakeRecords,
  CircleUsdcUnstakeRecords,
  Staker,
} from "../../generated/schema";
import { UNSTAKE_REQUEST_RAISED } from "../constants";

export function loadStaker(key: Address, event: ethereum.Event): Staker {
  let staker = Staker.load(key);

  if (!staker) {
    staker = new Staker(key);
    staker.staker = key.toHexString();
    staker.totalStaked = BigInt.fromI32(0);
    staker.circleUsdcStakeRecords = [];
    staker.circleUsdcUnstakeRecords = [];
  }

  staker.blockNumber = event.block.number;
  staker.blockTimestamp = event.block.timestamp;
  staker.transactionHash = event.transaction.hash;

  return staker;
}

// Entity array getters return a copy, so `staker.circleUsdcStakeRecords.push(id)`
// mutates a temporary and the list is never persisted. Append through these
// helpers, which write the array back; ids are de-duplicated because one
// (circle, staker) record is touched by every stake/exit in that circle.
function appendUnique(ids: Bytes[], id: Bytes): Bytes[] {
  for (let i = 0; i < ids.length; i++) {
    if (ids[i].equals(id)) return ids;
  }
  ids.push(id);
  return ids;
}

export function addStakerStakeRecord(staker: Staker, recordId: Bytes): void {
  staker.circleUsdcStakeRecords = appendUnique(
    staker.circleUsdcStakeRecords,
    recordId,
  );
}

export function addStakerUnstakeRecord(staker: Staker, recordId: Bytes): void {
  staker.circleUsdcUnstakeRecords = appendUnique(
    staker.circleUsdcUnstakeRecords,
    recordId,
  );
}

export function loadCircleUsdcStakeRecords(
  key: Bytes,
  event: ethereum.Event,
): CircleUsdcStakeRecords {
  let circleStakeRecord = CircleUsdcStakeRecords.load(key);

  if (!circleStakeRecord) {
    circleStakeRecord = new CircleUsdcStakeRecords(key);
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

export function loadCircleUsdcUnstakeRecords(
  key: Bytes,
  event: ethereum.Event,
): CircleUsdcUnstakeRecords {
  let circleUnstakeRecord = CircleUsdcUnstakeRecords.load(key);

  if (!circleUnstakeRecord) {
    circleUnstakeRecord = new CircleUsdcUnstakeRecords(key);
    // `circle` and `staker` are non-nullable. Every handler overwrites them
    // from the event, but a record first seen by ExitProceedsWithdrawn (its
    // ExitRequested log dropped by the provider) must still be saveable.
    circleUnstakeRecord.circle = Bytes.fromI32(0);
    circleUnstakeRecord.staker = Bytes.fromI32(0);
    circleUnstakeRecord.amount = BigInt.fromI32(0);
    circleUnstakeRecord.availableAt = BigInt.fromI32(0);
    circleUnstakeRecord.status = BigInt.fromI32(UNSTAKE_REQUEST_RAISED);
  }

  circleUnstakeRecord.blockNumber = event.block.number;
  circleUnstakeRecord.blockTimestamp = event.block.timestamp;
  circleUnstakeRecord.transactionHash = event.transaction.hash;

  return circleUnstakeRecord;
}
