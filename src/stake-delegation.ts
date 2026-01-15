import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ExitRequested as ExitRequestedEvent,
  ExitProceedsWithdrawn as ExitProceedsWithdrawnEvent,
  UsdcStakedForDelegationInCircle as UsdcStakedForDelegationInCircleEvent,
  UsdcDelegatedToMerchantInCircle as UsdcDelegatedToMerchantInCircleEvent,
  UsdcUndelegatedFromMerchantInCircle as UsdcUndelegatedFromMerchantInCircleEvent,
} from "../generated/USDCStakeDelegationFacet/USDCStakeDelegationFacet";
import { loadCircleStakeRecords, loadCircleUnstakeRecords, loadStaker } from "./utils/staker.utils";
import { loadCircle, loadCircleMerchant, loadCircleMetrics } from "./utils/circle.utils";
import { UNSTAKE_REQUEST_RAISED, UNSTAKE_REQUEST_WITHDRAWN } from "./constants";

export function handleExitRequested(event: ExitRequestedEvent): void {
  const stakeRecordKey = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.user.toHexString()}`
  );

  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);

  const staker = loadStaker(event.params.user, event);

  let circleUnstakeRecord = loadCircleUnstakeRecords(stakeRecordKey, event);

  circleUnstakeRecord.circle = circle.id;
  circleUnstakeRecord.staker = staker.id;
  circleUnstakeRecord.amount = event.params.amount;
  circleUnstakeRecord.status = BigInt.fromI32(UNSTAKE_REQUEST_RAISED)
  circleUnstakeRecord.availableAt = event.params.availableAt;

  staker.circleUnstakeRecords.push(circleUnstakeRecord.id);

  circleUnstakeRecord.save();

  const stakeRecord = loadCircleStakeRecords(stakeRecordKey, event);
  stakeRecord.unstakeRequest = circleUnstakeRecord.id;
  stakeRecord.save();
}

export function handleExitProceedsWithdrawn(
  event: ExitProceedsWithdrawnEvent
): void {
  const stakeRecordKey = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.user.toHexString()}`
  );

  // UPDATE CIRCLE UNSTAKE RECORD
  let unstakeRecord = loadCircleUnstakeRecords(stakeRecordKey, event);
  unstakeRecord.status =  BigInt.fromI32(UNSTAKE_REQUEST_WITHDRAWN)
  unstakeRecord.save()

  // UPDATE CIRCLE STAKE RECORD
  const stakeRecord = loadCircleStakeRecords(stakeRecordKey, event);
  stakeRecord.amount = stakeRecord.amount.minus(event.params.amount);
  stakeRecord.save()

  // UPDATE CIRCLE METRICS
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);
  const circleMetrics = loadCircleMetrics(circle.id, event);
  circleMetrics.totalStaked = circleMetrics.totalStaked.minus(event.params.amount);
  if(event.params.user.toHexString() == circle.admin) {
    circleMetrics.adminStaked = circleMetrics.adminStaked.minus(event.params.amount);
  }
  circleMetrics.save();

  // UPDATE STAKER
  const staker = loadStaker(event.params.user, event);
  staker.totalStaked = staker.totalStaked.minus(event.params.amount);
  staker.save();
}

export function handleUsdcStakedForDelegationInCircle(event: UsdcStakedForDelegationInCircleEvent): void {
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);

  const staker = loadStaker(event.params.user, event);
  staker.totalStaked = staker.totalStaked.plus(event.params.amount);
  staker.save();

  const stakeRecordKey = Bytes.fromHexString(`${event.params.circleId.toString()}-${event.params.user.toHexString()}`);
  const stakeRecord = loadCircleStakeRecords(stakeRecordKey, event);
  stakeRecord.circle = circle.id;
  stakeRecord.staker = staker.id;
  stakeRecord.amount = stakeRecord.amount.plus(event.params.amount);
  // CLEAR THE UNSTAKE REQUEST WHEN THE STAKE IS MADE
  stakeRecord.unstakeRequest = null;
  stakeRecord.stakedAt = event.block.timestamp;
  stakeRecord.save();

  staker.circleStakeRecords.push(stakeRecord.id);
  staker.save();

  const circleMetrics = loadCircleMetrics(circle.id, event);
  circleMetrics.totalStaked = circleMetrics.totalStaked.plus(event.params.amount);
  if(event.params.user.toHexString() == circle.admin) {
    circleMetrics.adminStaked = circleMetrics.adminStaked.plus(event.params.amount);
  }
  circleMetrics.save();
}

export function handleUsdcDelegatedToMerchantInCircle(event: UsdcDelegatedToMerchantInCircleEvent): void {
  // UPDATE CIRCLE MERCHANT
  const merchant = loadCircleMerchant(Bytes.fromHexString(event.params.merchant.toHexString()), event);
  merchant.delegatedStakedAmount = merchant.delegatedStakedAmount.plus(event.params.amount);
  merchant.save();

  // UPDATE CIRCLE METRICS
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circleMetrics = loadCircleMetrics(circleKey, event);
  circleMetrics.totalDelegatedStake = circleMetrics.totalDelegatedStake.plus(event.params.amount);
  circleMetrics.save();
}

export function handleUsdcUndelegatedFromMerchantInCircle(event: UsdcUndelegatedFromMerchantInCircleEvent): void { 
  // UPDATE CIRCLE MERCHANT
  const merchant = loadCircleMerchant(Bytes.fromHexString(event.params.merchant.toHexString()), event);
  merchant.delegatedStakedAmount = merchant.delegatedStakedAmount.minus(event.params.amount);
  merchant.save();

  // UPDATE CIRCLE METRICS
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circleMetrics = loadCircleMetrics(circleKey, event);
  circleMetrics.totalDelegatedStake = circleMetrics.totalDelegatedStake.minus(event.params.amount);
  circleMetrics.save();
}
