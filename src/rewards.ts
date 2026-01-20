import { Bytes } from "@graphprotocol/graph-ts";
import {
  CircleAdminRewardAllocated as CircleAdminRewardAllocatedEvent,
  CircleAdminRewardClaimed as CircleAdminRewardClaimedEvent,
  CircleAdminRewardAdjusted as CircleAdminRewardAdjustedEvent,
  MerchantRewardAllocated as MerchantRewardAllocatedEvent,
  MerchantRewardClaimed as MerchantRewardClaimedEvent,
  MerchantRewardAdjusted as MerchantRewardAdjustedEvent,
} from "../generated/RewardsFacet/RewardsFacet";
import {
  loadCircleAdminRewards,
  loadMerchantRewards,
} from "./lib";

export function handleCircleAdminRewardAllocated(
  event: CircleAdminRewardAllocatedEvent
): void {
  let circleAdminRewards = loadCircleAdminRewards(
    Bytes.fromHexString(event.params.admin.toHexString()),
    event
  );
  circleAdminRewards.admin = event.params.admin.toHexString();
  circleAdminRewards.lockedRewards =
    event.params.accountRewards.lockedRewards.plus(
      event.params.accountRewards.nextCycleLockedRewards
    );
  circleAdminRewards.claimableRewards =
    event.params.accountRewards.claimableRewards;

  circleAdminRewards.save();
}

export function handleCircleAdminRewardClaimed(
  event: CircleAdminRewardClaimedEvent
): void {
  let circleAdminRewards = loadCircleAdminRewards(
    Bytes.fromHexString(event.params.admin.toHexString()),
    event
  );

  circleAdminRewards.admin = event.params.admin.toHexString();
  circleAdminRewards.lockedRewards =
    event.params.accountRewards.lockedRewards.plus(
      event.params.accountRewards.nextCycleLockedRewards
    );
  circleAdminRewards.claimableRewards =
    event.params.accountRewards.claimableRewards;

  circleAdminRewards.withdrawnRewards =
    circleAdminRewards.withdrawnRewards.plus(event.params.amount);

  circleAdminRewards.earnedRewards = circleAdminRewards.withdrawnRewards
    .plus(circleAdminRewards.claimableRewards)
    .plus(circleAdminRewards.lockedRewards);

  circleAdminRewards.save();
}

export function handleCircleAdminRewardAdjusted(
  event: CircleAdminRewardAdjustedEvent
): void {
  let circleAdminRewards = loadCircleAdminRewards(
    Bytes.fromHexString(event.params.admin.toHexString()),
    event
  );
  circleAdminRewards.admin = event.params.admin.toHexString();
  circleAdminRewards.lockedRewards =
    event.params.accountRewards.lockedRewards.plus(
      event.params.accountRewards.nextCycleLockedRewards
    );
  circleAdminRewards.save();
}

export function handleMerchantRewardAllocated(
  event: MerchantRewardAllocatedEvent
): void {
  let merchantRewards = loadMerchantRewards(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );
  merchantRewards.merchant = event.params.merchant.toHexString();
  merchantRewards.lockedRewards =
    event.params.accountRewards.lockedRewards.plus(
      event.params.accountRewards.nextCycleLockedRewards
    );
  merchantRewards.claimableRewards =
    event.params.accountRewards.claimableRewards;

  merchantRewards.save();
}

export function handleMerchantRewardClaimed(
  event: MerchantRewardClaimedEvent
): void {
  let merchantRewards = loadMerchantRewards(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );
  merchantRewards.merchant = event.params.merchant.toHexString();
  merchantRewards.lockedRewards =
    event.params.accountRewards.lockedRewards.plus(
      event.params.accountRewards.nextCycleLockedRewards
    );
  merchantRewards.claimableRewards =
    event.params.accountRewards.claimableRewards;

  merchantRewards.withdrawnRewards =
    merchantRewards.withdrawnRewards.plus(event.params.amount);

  merchantRewards.earnedRewards = merchantRewards.withdrawnRewards
    .plus(merchantRewards.claimableRewards)
    .plus(merchantRewards.lockedRewards);

  merchantRewards.save();
}

export function handleMerchantRewardAdjusted(
  event: MerchantRewardAdjustedEvent
): void {
  let merchantRewards = loadMerchantRewards(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );
  merchantRewards.merchant = event.params.merchant.toHexString();
  merchantRewards.lockedRewards =
    event.params.accountRewards.lockedRewards.plus(
      event.params.accountRewards.nextCycleLockedRewards
    );
    merchantRewards.save();
}
