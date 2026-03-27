import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ExitRequested as ExitRequestedEvent,
  ExitProceedsWithdrawn as ExitProceedsWithdrawnEvent,
  UsdcStakedForDelegationInCircle as UsdcStakedForDelegationInCircleEvent,
  UsdcDelegatedToMerchantInCircle as UsdcDelegatedToMerchantInCircleEvent,
  UsdcUndelegatedFromMerchantInCircle as UsdcUndelegatedFromMerchantInCircleEvent,
} from "../generated/USDCStakeDelegationFacet/USDCStakeDelegationFacet";
import {
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadCircleUsdcStakeRecords,
  loadCircleUsdcUnstakeRecords,
  loadStaker,
  loadMerchantStakeHistory,
} from "./lib";
import {
  UNSTAKE_REQUEST_RAISED,
  UNSTAKE_REQUEST_WITHDRAWN,
  STAKE_HISTORY_TYPE_DELEGATED,
  STAKE_HISTORY_TYPE_UNDELEGATED,
} from "./constants";

export function handleExitRequested(event: ExitRequestedEvent): void {
  const stakeRecordKey = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.user.toHexString()}`,
  );

  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);

  const staker = loadStaker(event.params.user, event);

  let circleUnstakeRecord = loadCircleUsdcUnstakeRecords(stakeRecordKey, event);

  circleUnstakeRecord.circle = circle.id;
  circleUnstakeRecord.staker = staker.id;
  circleUnstakeRecord.amount = event.params.amount;
  circleUnstakeRecord.status = BigInt.fromI32(UNSTAKE_REQUEST_RAISED);
  circleUnstakeRecord.availableAt = event.params.availableAt;

  staker.circleUsdcUnstakeRecords.push(circleUnstakeRecord.id);

  circleUnstakeRecord.save();

  const stakeRecord = loadCircleUsdcStakeRecords(stakeRecordKey, event);
  stakeRecord.unstakeRequest = circleUnstakeRecord.id;
  stakeRecord.save();
}

export function handleExitProceedsWithdrawn(
  event: ExitProceedsWithdrawnEvent,
): void {
  const stakeRecordKey = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.user.toHexString()}`,
  );

  // UPDATE CIRCLE UNSTAKE RECORD
  let unstakeRecord = loadCircleUsdcUnstakeRecords(stakeRecordKey, event);
  unstakeRecord.status = BigInt.fromI32(UNSTAKE_REQUEST_WITHDRAWN);
  unstakeRecord.save();

  // UPDATE CIRCLE STAKE RECORD
  const stakeRecord = loadCircleUsdcStakeRecords(stakeRecordKey, event);
  stakeRecord.amount = stakeRecord.amount.minus(event.params.amount);
  stakeRecord.save();

  // UPDATE CIRCLE METRICS
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);
  const circleMetrics = loadCircleMetrics(circle.id, event);
  circleMetrics.totalUsdcStaked = circleMetrics.totalUsdcStaked.minus(
    event.params.amount,
  );
  if (event.params.user.toHexString() == circle.admin) {
    circleMetrics.adminUsdcStaked = circleMetrics.adminUsdcStaked.minus(
      event.params.amount,
    );
  }
  circleMetrics.save();

  // UPDATE STAKER
  const staker = loadStaker(event.params.user, event);
  staker.totalStaked = staker.totalStaked.minus(event.params.amount);
  staker.save();
}

export function handleUsdcStakedForDelegationInCircle(
  event: UsdcStakedForDelegationInCircleEvent,
): void {
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);

  const staker = loadStaker(event.params.user, event);
  staker.totalStaked = staker.totalStaked.plus(event.params.amount);
  staker.save();

  const stakeRecordKey = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.user.toHexString()}`,
  );
  const stakeRecord = loadCircleUsdcStakeRecords(stakeRecordKey, event);
  stakeRecord.circle = circle.id;
  stakeRecord.staker = staker.id;
  stakeRecord.amount = stakeRecord.amount.plus(event.params.amount);
  // CLEAR THE UNSTAKE REQUEST WHEN THE STAKE IS MADE
  stakeRecord.unstakeRequest = null;
  stakeRecord.stakedAt = event.block.timestamp;
  stakeRecord.save();

  staker.circleUsdcStakeRecords.push(stakeRecord.id);
  staker.save();

  const circleMetrics = loadCircleMetrics(circle.id, event);
  circleMetrics.totalUsdcStaked = circleMetrics.totalUsdcStaked.plus(
    event.params.amount,
  );
  if (event.params.user.toHexString() == circle.admin) {
    circleMetrics.adminUsdcStaked = circleMetrics.adminUsdcStaked.plus(
      event.params.amount,
    );
  }
  circleMetrics.save();
}

export function handleUsdcDelegatedToMerchantInCircle(
  event: UsdcDelegatedToMerchantInCircleEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  // UPDATE CIRCLE MERCHANT
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  merchant.delegatedStakedAmount = merchant.delegatedStakedAmount.plus(
    event.params.amount,
  );
  merchant.stakedAmount = merchant.stakedAmount.plus(event.params.amount);
  merchant.save();

  // Record stake history
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);

  const stakeHistoryKey = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-DELEGATED-${event.transaction.hash.toHexString()}-${event.logIndex.toString()}`,
  );
  const stakeHistory = loadMerchantStakeHistory(stakeHistoryKey, event);
  stakeHistory.merchant = merchant.id;
  stakeHistory.circle = circle.id;
  stakeHistory.type = STAKE_HISTORY_TYPE_DELEGATED;
  stakeHistory.balanceBefore = merchant.stakedAmount.minus(event.params.amount);
  stakeHistory.balanceAfter = merchant.stakedAmount;
  stakeHistory.save();

  // UPDATE CIRCLE METRICS
  const circleMetrics = loadCircleMetrics(circleKey, event);
  circleMetrics.totalDelegatedStake = circleMetrics.totalDelegatedStake.plus(
    event.params.amount,
  );
  circleMetrics.save();
}

export function handleUsdcUndelegatedFromMerchantInCircle(
  event: UsdcUndelegatedFromMerchantInCircleEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  // UPDATE CIRCLE MERCHANT
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  merchant.delegatedStakedAmount = merchant.delegatedStakedAmount.minus(
    event.params.amount,
  );
  merchant.stakedAmount = merchant.stakedAmount.minus(event.params.amount);
  merchant.save();

  // Record stake history
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);

  const stakeHistoryKey = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-UNDELEGATED-${event.transaction.hash.toHexString()}-${event.logIndex.toString()}`,
  );
  const stakeHistory = loadMerchantStakeHistory(stakeHistoryKey, event);
  stakeHistory.merchant = merchant.id;
  stakeHistory.circle = circle.id;
  stakeHistory.type = STAKE_HISTORY_TYPE_UNDELEGATED;
  stakeHistory.balanceBefore = merchant.stakedAmount.plus(event.params.amount);
  stakeHistory.balanceAfter = merchant.stakedAmount;
  stakeHistory.save();

  // UPDATE CIRCLE METRICS
  const circleMetrics = loadCircleMetrics(circleKey, event);
  circleMetrics.totalDelegatedStake = circleMetrics.totalDelegatedStake.minus(
    event.params.amount,
  );
  circleMetrics.save();
}
