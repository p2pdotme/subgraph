import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
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
  NonPoolTokenSwept as NonPoolTokenSweptEvent,
  SeizedStakeRecorded as SeizedStakeRecordedEvent,
  SeizedStakeReleased as SeizedStakeReleasedEvent,
  SeizedMerchantStakeToCaip as SeizedMerchantStakeToCaipEvent,
  PIPContributed as PIPContributedEvent,
} from "../generated/InsurancePoolFacet/InsurancePoolFacet";
import {
  InsuranceNonPoolTokenSweep,
  PIPContribution,
  SeizedStake,
  SeizedStakeActivity,
} from "../generated/schema";
import { bytes32ToAscii, logKey } from "./utils";
import {
  SEIZED_ACTION_MERCHANT_STAKE_TO_CAIP,
  SEIZED_ACTION_RECORDED,
  SEIZED_ACTION_RELEASED,
} from "./constants/status";
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

export function handlePIPRefillRequested(event: PIPRefillRequestedEvent): void {
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

export function handlePIPRefillCancelled(event: PIPRefillCancelledEvent): void {
  const entity = loadPIPRefillRequest(event.params.circleId, event);

  // RefillStatus.CANCELLED = 2
  entity.status = 2;
  entity.resolvedAt = event.block.timestamp;

  entity.save();
}

export function handlePIPRefillApproved(event: PIPRefillApprovedEvent): void {
  const entity = loadPIPRefillRequest(event.params.circleId, event);

  // RefillStatus.APPROVED = 1
  entity.status = 1;
  entity.approvedAmount = event.params.amount;
  entity.resolvedAt = event.block.timestamp;

  entity.save();
}

export function handlePIPRefillRejected(event: PIPRefillRejectedEvent): void {
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

// ─────────────────────────── R1 non-pool token recovery ──────────────────
// Seized $P2P boost stakes arrive at the Insurance Diamond address but are
// not pool assets; `sweepNonPoolToken` moves them to the Governance Diamond.
export function handleNonPoolTokenSwept(event: NonPoolTokenSweptEvent): void {
  const entity = new InsuranceNonPoolTokenSweep(
    logKey(event.transaction.hash, event.logIndex),
  );
  entity.token = event.params.token;
  entity.to = event.params.to;
  entity.amount = event.params.amount;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

// ─────────────────── R8.2 seized stake (country pools) ───────────────────
// A force-recovered stake is credited to the COUNTRY insurance pool, not paid
// to whoever triggered the recovery. The running `amount` here is derived from
// the events in the indexed range; `getSeizedStake(token, country)` is the
// authority (see the note on the entity).

function loadSeizedStake(
  token: Bytes,
  country: Bytes,
  event: ethereum.Event,
): SeizedStake {
  const id = token.concat(country);
  let row = SeizedStake.load(id);
  if (!row) {
    row = new SeizedStake(id);
    row.token = token;
    row.country = country;
    row.countryCode = bytes32ToAscii(country);
    row.amount = BigInt.zero();
    row.recordedTotal = BigInt.zero();
    row.releasedTotal = BigInt.zero();
    row.lastRecordedAt = null;
    row.lastReleasedAt = null;
  }
  row.blockNumber = event.block.number;
  row.blockTimestamp = event.block.timestamp;
  row.transactionHash = event.transaction.hash;
  return row;
}

function newSeizedActivity(
  event: ethereum.Event,
  action: string,
  country: Bytes,
  amount: BigInt,
): SeizedStakeActivity {
  const activity = new SeizedStakeActivity(
    logKey(event.transaction.hash, event.logIndex),
  );
  activity.action = action;
  activity.country = country;
  activity.countryCode = bytes32ToAscii(country);
  activity.amount = amount;
  activity.blockNumber = event.block.number;
  activity.blockTimestamp = event.block.timestamp;
  activity.transactionHash = event.transaction.hash;
  return activity;
}

export function handleSeizedStakeRecorded(
  event: SeizedStakeRecordedEvent,
): void {
  const row = loadSeizedStake(event.params.token, event.params.country, event);
  row.recordedTotal = row.recordedTotal.plus(event.params.amount);
  row.amount = row.amount.plus(event.params.amount);
  row.lastRecordedAt = event.block.timestamp;
  row.save();

  const activity = newSeizedActivity(
    event,
    SEIZED_ACTION_RECORDED,
    event.params.country,
    event.params.amount,
  );
  activity.token = event.params.token;
  activity.seizedStake = row.id;
  activity.save();
}

export function handleSeizedStakeReleased(
  event: SeizedStakeReleasedEvent,
): void {
  const row = loadSeizedStake(event.params.token, event.params.country, event);
  row.releasedTotal = row.releasedTotal.plus(event.params.amount);
  // Can go negative for a subgraph that started indexing after the seizure it
  // releases. Clamping would hide that; the entity comment says to read the
  // balance from the chain.
  row.amount = row.amount.minus(event.params.amount);
  row.lastReleasedAt = event.block.timestamp;
  row.save();

  const activity = newSeizedActivity(
    event,
    SEIZED_ACTION_RELEASED,
    event.params.country,
    event.params.amount,
  );
  activity.token = event.params.token;
  activity.seizedStake = row.id;
  activity.to = event.params.to;
  activity.save();
}

// Keyed by circle, not token: this credits a circle's own insurance pool
// (CAIP), so it does NOT move the token/country seized-stake ledger.
export function handleSeizedMerchantStakeToCaip(
  event: SeizedMerchantStakeToCaipEvent,
): void {
  const activity = newSeizedActivity(
    event,
    SEIZED_ACTION_MERCHANT_STAKE_TO_CAIP,
    event.params.country,
    event.params.amount,
  );
  activity.circleId = event.params.circleId;
  activity.save();
}

// `contributeToPIP` is open to anyone, so `from` carries no authority.
export function handlePIPContributed(event: PIPContributedEvent): void {
  const row = new PIPContribution(
    logKey(event.transaction.hash, event.logIndex),
  );
  row.from = event.params.from;
  row.amount = event.params.amount;
  row.blockNumber = event.block.number;
  row.blockTimestamp = event.block.timestamp;
  row.transactionHash = event.transaction.hash;
  row.save();
}
