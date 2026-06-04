import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  UserP2PStake,
  UserP2PStakeActivity,
} from "../../generated/schema";
import { P2P_STAKE_STATUS_NONE } from "../constants";

export function loadUserP2PStake(
  user: Address,
  event: ethereum.Event,
): UserP2PStake {
  const key = changetype<Bytes>(user);
  let stake = UserP2PStake.load(key);

  if (!stake) {
    stake = new UserP2PStake(key);
    stake.user = key;
    stake.stakedAmount = BigInt.zero();
    stake.status = P2P_STAKE_STATUS_NONE;
    stake.cooldownEnd = BigInt.zero();
    stake.totalSeized = BigInt.zero();
    stake.firstStakedAt = BigInt.zero();
    stake.lastActionAt = BigInt.zero();
    stake.fraudReserve = null;
  }

  stake.blockNumber = event.block.number;
  stake.blockTimestamp = event.block.timestamp;
  stake.transactionHash = event.transaction.hash;

  return stake;
}

export function newUserP2PStakeActivity(
  event: ethereum.Event,
): UserP2PStakeActivity {
  const key = event.transaction.hash.concatI32(event.logIndex.toI32());
  const activity = new UserP2PStakeActivity(key);
  activity.blockNumber = event.block.number;
  activity.blockTimestamp = event.block.timestamp;
  activity.transactionHash = event.transaction.hash;
  activity.timestamp = event.block.timestamp;
  activity.amount = BigInt.zero();
  activity.newTotal = BigInt.zero();
  activity.cooldownEnd = BigInt.zero();
  activity.fraudReserve = null;
  return activity;
}
