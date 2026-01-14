import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ExitRequested as ExitRequestedEvent,
  ExitProceedsWithdrawn as ExitProceedsWithdrawnEvent,
  UsdcStakedForDelegationInCircle as UsdcStakedForDelegationInCircleEvent,
} from "../generated/USDCStakeDelegationFacet/USDCStakeDelegationFacet";
import { loadCircleStakeRecords, loadCircleUnstakeRecords, loadStaker } from "./utils/staker.utils";
import { loadCircle, loadCircleMetrics } from "./utils/circle.utils";
import { UNSTAKE_REQUEST_WITHDRAWN } from "./constants";

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
  let unstakeRecord = loadCircleUnstakeRecords(stakeRecordKey, event);
  unstakeRecord.status =  BigInt.fromI32(UNSTAKE_REQUEST_WITHDRAWN)
  unstakeRecord.save()

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
  // CLEAR THE UNSTAKE REQUEST
  stakeRecord.unstakeRequest = null;
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