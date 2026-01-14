import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ExitRequested as ExitRequestedEvent,
  ExitProceedsWithdrawn as ExitProceedsWithdrawnEvent,
  UsdcStakedForDelegationInCircle as UsdcStakedForDelegationInCircleEvent,
} from "../generated/USDCStakeDelegationFacet/USDCStakeDelegationFacet";
import { loadCircleStakeRecords, loadStaker } from "./utils/staker.utils";
import { loadCircle, loadCircleMerchant, loadCircleMetrics } from "./utils/circle.utils";
import { STATUS_PENDING, STATUS_COMPLETED } from "./constants";

export function handleExitRequested(event: ExitRequestedEvent): void {
}

export function handleExitProceedsWithdrawn(
  event: ExitProceedsWithdrawnEvent
): void {

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