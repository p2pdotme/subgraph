import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { CircleAdminRewards, MerchantRewards } from "../../generated/schema";

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
