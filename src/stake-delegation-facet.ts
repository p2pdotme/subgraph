import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ExitRequested as ExitRequestedEvent,
  ExitProceedsWithdrawn as ExitProceedsWithdrawnEvent,
} from "../generated/USDCStakeDelegationFacet/USDCStakeDelegationFacet";
import { loadCircleUnstakeRecords, loadStaker } from "./utils/staker.utils";
import { loadCircle } from "./utils/circle.utils";
import { STATUS_PENDING, STATUS_COMPLETED } from "./constants";

export function handleExitRequested(event: ExitRequestedEvent): void {
  const id = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.user.toHexString()}`
  );

  const circle = loadCircle(
    Bytes.fromHexString(event.params.circleId.toString()),
    event
  );

  const staker = loadStaker(event.params.user, event);

  let circleUnstakeRecord = loadCircleUnstakeRecords(id, event);

  circleUnstakeRecord.circle = circle.id;
  circleUnstakeRecord.staker = staker.id;
  circleUnstakeRecord.amount = event.params.amount;
  circleUnstakeRecord.status = BigInt.fromI32(STATUS_PENDING);
  circleUnstakeRecord.availableAt = event.params.availableAt;

  staker.circleUnstakeRecords.push(circleUnstakeRecord.id);

  circleUnstakeRecord.save();
}

export function handleExitProceedsWithdrawn(
  event: ExitProceedsWithdrawnEvent
): void {
  const id = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.user.toHexString()}`
  );
  let circleUnstakeRecord = loadCircleUnstakeRecords(id, event);

  circleUnstakeRecord.status = BigInt.fromI32(STATUS_COMPLETED);

  circleUnstakeRecord.save();
}
