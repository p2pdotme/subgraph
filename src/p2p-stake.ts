import {
  P2PStaked as P2PStakedEvent,
  P2PStakeToppedUp as P2PStakeToppedUpEvent,
  P2PUnstakeRequested as P2PUnstakeRequestedEvent,
  P2PUnstakeCancelled as P2PUnstakeCancelledEvent,
  P2PUnstakeClaimed as P2PUnstakeClaimedEvent,
  P2PStakeCooldownExtended as P2PStakeCooldownExtendedEvent,
  P2PStakeSeized as P2PStakeSeizedEvent,
} from "../generated/P2PStakeBoostFacet/P2PStakeBoostFacet";
import { loadUserP2PStake, newUserP2PStakeActivity } from "./lib";
import {
  P2P_STAKE_STATUS_ACTIVE,
  P2P_STAKE_STATUS_COOLDOWN,
  P2P_STAKE_STATUS_NONE,
  P2P_STAKE_STATUS_SEIZED,
  P2P_ACTIVITY_STAKED,
  P2P_ACTIVITY_TOPPED_UP,
  P2P_ACTIVITY_UNSTAKE_REQUESTED,
  P2P_ACTIVITY_UNSTAKE_CANCELLED,
  P2P_ACTIVITY_UNSTAKE_CLAIMED,
  P2P_ACTIVITY_COOLDOWN_EXTENDED,
  P2P_ACTIVITY_SEIZED,
} from "./constants";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleP2PStaked(event: P2PStakedEvent): void {
  const stake = loadUserP2PStake(event.params.user, event);

  stake.stakedAmount = event.params.newTotal;
  stake.status = P2P_STAKE_STATUS_ACTIVE;
  stake.cooldownEnd = BigInt.zero();
  if (stake.firstStakedAt.equals(BigInt.zero())) {
    stake.firstStakedAt = event.block.timestamp;
  }
  stake.lastActionAt = event.block.timestamp;
  stake.save();

  const activity = newUserP2PStakeActivity(event);
  activity.stake = stake.id;
  activity.user = stake.user;
  activity.userAddress = event.params.user.toHexString();
  activity.activityType = P2P_ACTIVITY_STAKED;
  activity.amount = event.params.amount;
  activity.newTotal = event.params.newTotal;
  activity.stakedAmountAfter = stake.stakedAmount;
  activity.statusAfter = stake.status;
  activity.save();
}

export function handleP2PStakeToppedUp(event: P2PStakeToppedUpEvent): void {
  const stake = loadUserP2PStake(event.params.user, event);

  stake.stakedAmount = event.params.newTotal;
  // The contract guarantees status == ACTIVE for top-ups; reasserted defensively.
  stake.status = P2P_STAKE_STATUS_ACTIVE;
  stake.lastActionAt = event.block.timestamp;
  stake.save();

  const activity = newUserP2PStakeActivity(event);
  activity.stake = stake.id;
  activity.user = stake.user;
  activity.userAddress = event.params.user.toHexString();
  activity.activityType = P2P_ACTIVITY_TOPPED_UP;
  activity.amount = event.params.amount;
  activity.newTotal = event.params.newTotal;
  activity.stakedAmountAfter = stake.stakedAmount;
  activity.statusAfter = stake.status;
  activity.save();
}

export function handleP2PUnstakeRequested(
  event: P2PUnstakeRequestedEvent,
): void {
  const stake = loadUserP2PStake(event.params.user, event);

  stake.status = P2P_STAKE_STATUS_COOLDOWN;
  stake.cooldownEnd = event.params.cooldownEnd;
  stake.lastActionAt = event.block.timestamp;
  stake.save();

  const activity = newUserP2PStakeActivity(event);
  activity.stake = stake.id;
  activity.user = stake.user;
  activity.userAddress = event.params.user.toHexString();
  activity.activityType = P2P_ACTIVITY_UNSTAKE_REQUESTED;
  activity.amount = event.params.amount;
  activity.cooldownEnd = event.params.cooldownEnd;
  activity.stakedAmountAfter = stake.stakedAmount;
  activity.statusAfter = stake.status;
  activity.save();
}

export function handleP2PUnstakeCancelled(
  event: P2PUnstakeCancelledEvent,
): void {
  const stake = loadUserP2PStake(event.params.user, event);

  // Cancellation reverts COOLDOWN -> ACTIVE; stakedAmount is unchanged on-chain.
  stake.status = P2P_STAKE_STATUS_ACTIVE;
  stake.cooldownEnd = BigInt.zero();
  stake.lastActionAt = event.block.timestamp;
  stake.save();

  const activity = newUserP2PStakeActivity(event);
  activity.stake = stake.id;
  activity.user = stake.user;
  activity.userAddress = event.params.user.toHexString();
  activity.activityType = P2P_ACTIVITY_UNSTAKE_CANCELLED;
  activity.amount = event.params.amount;
  activity.stakedAmountAfter = stake.stakedAmount;
  activity.statusAfter = stake.status;
  activity.save();
}

export function handleP2PUnstakeClaimed(event: P2PUnstakeClaimedEvent): void {
  const stake = loadUserP2PStake(event.params.user, event);

  stake.stakedAmount = BigInt.zero();
  stake.status = P2P_STAKE_STATUS_NONE;
  stake.cooldownEnd = BigInt.zero();
  stake.lastActionAt = event.block.timestamp;
  stake.save();

  const activity = newUserP2PStakeActivity(event);
  activity.stake = stake.id;
  activity.user = stake.user;
  activity.userAddress = event.params.user.toHexString();
  activity.activityType = P2P_ACTIVITY_UNSTAKE_CLAIMED;
  activity.amount = event.params.amount;
  activity.stakedAmountAfter = stake.stakedAmount;
  activity.statusAfter = stake.status;
  activity.save();
}

export function handleP2PStakeCooldownExtended(
  event: P2PStakeCooldownExtendedEvent,
): void {
  const stake = loadUserP2PStake(event.params.user, event);

  stake.status = P2P_STAKE_STATUS_COOLDOWN;
  stake.cooldownEnd = event.params.newCooldownEnd;
  stake.lastActionAt = event.block.timestamp;
  stake.save();

  const activity = newUserP2PStakeActivity(event);
  activity.stake = stake.id;
  activity.user = stake.user;
  activity.userAddress = event.params.user.toHexString();
  activity.activityType = P2P_ACTIVITY_COOLDOWN_EXTENDED;
  activity.cooldownEnd = event.params.newCooldownEnd;
  activity.stakedAmountAfter = stake.stakedAmount;
  activity.statusAfter = stake.status;
  activity.save();
}

export function handleP2PStakeSeized(event: P2PStakeSeizedEvent): void {
  const stake = loadUserP2PStake(event.params.user, event);

  stake.stakedAmount = BigInt.zero();
  stake.status = P2P_STAKE_STATUS_SEIZED;
  stake.cooldownEnd = BigInt.zero();
  stake.totalSeized = stake.totalSeized.plus(event.params.amount);
  stake.fraudReserve = event.params.fraudReserve;
  stake.lastActionAt = event.block.timestamp;
  stake.save();

  const activity = newUserP2PStakeActivity(event);
  activity.stake = stake.id;
  activity.user = stake.user;
  activity.userAddress = event.params.user.toHexString();
  activity.activityType = P2P_ACTIVITY_SEIZED;
  activity.amount = event.params.amount;
  activity.fraudReserve = event.params.fraudReserve;
  activity.stakedAmountAfter = stake.stakedAmount;
  activity.statusAfter = stake.status;
  activity.save();
}
