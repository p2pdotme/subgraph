import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CircleAdminRewards,
  CircleAdminRewardClaimLedger,
  MerchantRewards,
  MerchantRewardClaimLedger,
} from "../../generated/schema";

export function loadCircleAdminRewards(
  key: Bytes,
  event: ethereum.Event,
): CircleAdminRewards {
  let circleAdminRewards = CircleAdminRewards.load(key);

  if (!circleAdminRewards) {
    circleAdminRewards = new CircleAdminRewards(key);
    circleAdminRewards.admin = "";
    circleAdminRewards.lockedRewards = BigInt.zero();
    circleAdminRewards.earnedRewards = BigInt.zero();
    circleAdminRewards.withdrawnRewards = BigInt.zero();
    circleAdminRewards.claimableRewards = BigInt.zero();
  }

  circleAdminRewards.blockNumber = event.block.number;
  circleAdminRewards.blockTimestamp = event.block.timestamp;
  circleAdminRewards.transactionHash = event.transaction.hash;

  return circleAdminRewards;
}

export function loadMerchantRewards(
  key: Bytes,
  event: ethereum.Event,
): MerchantRewards {
  let merchantRewards = MerchantRewards.load(key);

  if (!merchantRewards) {
    merchantRewards = new MerchantRewards(key);
    merchantRewards.merchant = "";
    merchantRewards.lockedRewards = BigInt.zero();
    merchantRewards.earnedRewards = BigInt.zero();
    merchantRewards.withdrawnRewards = BigInt.zero();
    merchantRewards.claimableRewards = BigInt.zero();
  }

  merchantRewards.blockNumber = event.block.number;
  merchantRewards.blockTimestamp = event.block.timestamp;
  merchantRewards.transactionHash = event.transaction.hash;

  return merchantRewards;
}

export function loadCircleAdminRewardClaimLedger(
  key: Bytes,
  event: ethereum.Event,
): CircleAdminRewardClaimLedger {
  let circleAdminRewardClaimLedger = CircleAdminRewardClaimLedger.load(key);

  if (!circleAdminRewardClaimLedger) {
    circleAdminRewardClaimLedger = new CircleAdminRewardClaimLedger(key);
    circleAdminRewardClaimLedger.admin = "";
    circleAdminRewardClaimLedger.amount = BigInt.zero();
    circleAdminRewardClaimLedger.claimedAt = BigInt.zero();
  }

  circleAdminRewardClaimLedger.blockNumber = event.block.number;
  circleAdminRewardClaimLedger.blockTimestamp = event.block.timestamp;
  circleAdminRewardClaimLedger.transactionHash = event.transaction.hash;

  return circleAdminRewardClaimLedger;
}

export function loadMerchantRewardClaimLedger(
  key: Bytes,
  event: ethereum.Event,
): MerchantRewardClaimLedger {
  let merchantRewardClaimLedger = MerchantRewardClaimLedger.load(key);

  if (!merchantRewardClaimLedger) {
    merchantRewardClaimLedger = new MerchantRewardClaimLedger(key);
    merchantRewardClaimLedger.merchant = "";
    merchantRewardClaimLedger.amount = BigInt.zero();
    merchantRewardClaimLedger.claimedAt = BigInt.zero();
  }

  merchantRewardClaimLedger.blockNumber = event.block.number;
  merchantRewardClaimLedger.blockTimestamp = event.block.timestamp;
  merchantRewardClaimLedger.transactionHash = event.transaction.hash;

  return merchantRewardClaimLedger;
}

// earnedRewards = withdrawn + claimable + locked (lockedRewards already holds
// next-cycle locked). Recomputed on every rewards event: it used to be set
// only on claims, so allocations and adjustments since the last claim (or
// any, for an account that never claimed) were missing from it.
export function refreshCircleAdminEarned(rewards: CircleAdminRewards): void {
  rewards.earnedRewards = rewards.withdrawnRewards
    .plus(rewards.claimableRewards)
    .plus(rewards.lockedRewards);
}

export function refreshMerchantEarned(rewards: MerchantRewards): void {
  rewards.earnedRewards = rewards.withdrawnRewards
    .plus(rewards.claimableRewards)
    .plus(rewards.lockedRewards);
}
