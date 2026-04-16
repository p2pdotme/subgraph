import {
  PIPRefillRequested as PIPRefillRequestedEvent,
  PIPRefillCancelled as PIPRefillCancelledEvent,
  PIPRefillApproved as PIPRefillApprovedEvent,
} from "../generated/InsurancePoolFacet/InsurancePoolFacet";
import { loadPIPRefillRequest } from "./lib";

export function handlePIPRefillRequested(
  event: PIPRefillRequestedEvent,
): void {
  const entity = loadPIPRefillRequest(event.params.circleId, event);

  entity.requestedBy = event.params.admin;
  entity.requestedAmount = event.params.amount;
  // RefillStatus.PENDING = 0
  entity.status = 0;
  entity.requestedAt = event.block.timestamp;
  entity.resolvedAt = entity.resolvedAt; // reset if re-requested

  entity.save();
}

export function handlePIPRefillCancelled(
  event: PIPRefillCancelledEvent,
): void {
  const entity = loadPIPRefillRequest(event.params.circleId, event);

  // RefillStatus.CANCELLED = 2
  entity.status = 2;
  entity.resolvedAt = event.block.timestamp;

  entity.save();
}

export function handlePIPRefillApproved(
  event: PIPRefillApprovedEvent,
): void {
  const entity = loadPIPRefillRequest(event.params.circleId, event);

  // RefillStatus.APPROVED = 1
  entity.status = 1;
  entity.approvedAmount = event.params.amount;
  entity.resolvedAt = event.block.timestamp;

  entity.save();
}
