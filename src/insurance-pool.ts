import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  PIPRefillRequested as PIPRefillRequestedEvent,
  PIPRefillCancelled as PIPRefillCancelledEvent,
  PIPRefillApproved as PIPRefillApprovedEvent,
  PIPRefillRejected as PIPRefillRejectedEvent,
  CurrencyApproverUpdated as CurrencyApproverUpdatedEvent,
  InsuranceConfigUpdated as InsuranceConfigUpdatedEvent,
  CALRLocked as CALRLockedEvent,
  CALRUnlocked as CALRUnlockedEvent,
  CALRLockReverted as CALRLockRevertedEvent,
} from "../generated/InsurancePoolFacet/InsurancePoolFacet";
import {
  InsuranceApprover,
  InsuranceCurrencyConfig,
  PIPRefillRequest,
} from "../generated/schema";
import {
  loadPIPRefillRequest,
  loadCircleAdminCALR,
  newCALRActivity,
} from "./lib";

export function handlePIPRefillRequested(
  event: PIPRefillRequestedEvent,
): void {
  const circleIdBytes = Bytes.fromByteArray(
    Bytes.fromBigInt(event.params.circleId),
  );

  // If a request already exists for this circle, archive it under a unique id
  const existing = PIPRefillRequest.load(circleIdBytes);
  if (existing) {
    const archived = new PIPRefillRequest(
      event.transaction.hash.concatI32(event.logIndex.toI32()),
    );
    archived.circleId = existing.circleId;
    archived.circle = existing.circle;
    archived.requestedBy = existing.requestedBy;
    archived.requestedAmount = existing.requestedAmount;
    archived.status = existing.status;
    archived.requestedAt = existing.requestedAt;
    archived.resolvedAt = existing.resolvedAt;
    archived.approvedAmount = existing.approvedAmount;
    archived.blockNumber = existing.blockNumber;
    archived.blockTimestamp = existing.blockTimestamp;
    archived.transactionHash = existing.transactionHash;
    archived.save();
  }

  // Write the new request into the circleId slot
  const entity = loadPIPRefillRequest(event.params.circleId, event);
  entity.requestedBy = event.params.admin;
  entity.requestedAmount = event.params.amount;
  // RefillStatus.PENDING = 0
  entity.status = 0;
  entity.requestedAt = event.block.timestamp;
  entity.resolvedAt = BigInt.zero();
  entity.approvedAmount = BigInt.zero();

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

export function handlePIPRefillRejected(
  event: PIPRefillRejectedEvent,
): void {
  const entity = loadPIPRefillRequest(event.params.circleId, event);

  // RefillStatus.REJECTED = 3
  entity.status = 3;
  entity.resolvedAt = event.block.timestamp;

  entity.save();
}

export function handleCurrencyApproverUpdated(
  event: CurrencyApproverUpdatedEvent,
): void {
  const id = event.params.currency.concat(
    Bytes.fromHexString(event.params.approver.toHexString()),
  );

  let entity = InsuranceApprover.load(id);
  if (!entity) {
    entity = new InsuranceApprover(id);
    entity.currency = event.params.currency;
    entity.approver = event.params.approver;
  }

  entity.allowed = event.params.allowed;
  entity.admin = event.params.admin;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleInsuranceConfigUpdated(
  event: InsuranceConfigUpdatedEvent,
): void {
  const currency = event.params.currency;
  const cfg = event.params.newConfig;

  let entity = InsuranceCurrencyConfig.load(currency);
  if (!entity) {
    entity = new InsuranceCurrencyConfig(currency);
    entity.currency = currency;
  }

  entity.caipFeeBps = cfg.caipFeeBps;
  entity.calrLockBps = cfg.calrLockBps;
  entity.calrLockPeriod = cfg.calrLockPeriod;
  entity.payoutDelay = cfg.payoutDelay;
  entity.maxClaimAge = cfg.maxClaimAge;
  entity.orderClaimWindow = cfg.orderClaimWindow;
  entity.largeClaimThreshold = cfg.largeClaimThreshold;

  entity.updatedBy = event.params.admin;
  entity.updatedAt = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleCALRLocked(event: CALRLockedEvent): void {
  const admin = event.params.admin;

  const calr = loadCircleAdminCALR(admin, event);
  calr.totalLocked = calr.totalLocked.plus(event.params.amount);
  calr.lastLockExpiresAt = event.params.lockExpiresAt;
  calr.save();

  const activity = newCALRActivity(event, admin, "LOCKED", event.params.amount);
  activity.lockExpiresAt = event.params.lockExpiresAt;
  activity.save();
}

// Covers both the admin-initiated unlockCALR and the main Diamond's
// pullUnlockableCALR (single-tx claim of CALR + regular rewards) — the
// contract emits the same event with the admin as topic on both paths.
export function handleCALRUnlocked(event: CALRUnlockedEvent): void {
  const admin = event.params.admin;

  const calr = loadCircleAdminCALR(admin, event);
  calr.totalUnlocked = calr.totalUnlocked.plus(event.params.amount);
  calr.save();

  newCALRActivity(event, admin, "UNLOCKED", event.params.amount).save();
}

export function handleCALRLockReverted(event: CALRLockRevertedEvent): void {
  const admin = event.params.admin;

  const calr = loadCircleAdminCALR(admin, event);
  calr.totalReverted = calr.totalReverted.plus(event.params.actual);
  calr.save();

  // `actual` is what actually left the bucket; `snapshot` is what the revert
  // tried to return (shortfall = snapshot - actual).
  const activity = newCALRActivity(
    event,
    admin,
    "LOCK_REVERTED",
    event.params.actual,
  );
  activity.orderId = event.params.orderId;
  activity.snapshotAmount = event.params.snapshot;
  activity.save();
}
