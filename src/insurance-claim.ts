import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  ClaimSubmitted as ClaimSubmittedEvent,
  ClaimApproved as ClaimApprovedEvent,
  ClaimRejected as ClaimRejectedEvent,
  ClaimForceRejected as ClaimForceRejectedEvent,
  ApprovedClaimCancelled as ApprovedClaimCancelledEvent,
  ClaimWithdrawn as ClaimWithdrawnEvent,
  ClaimSettled as ClaimSettledEvent,
  SuperAdminLargeClaimApproved as SuperAdminLargeClaimApprovedEvent,
  ClaimContested as ClaimContestedEvent,
  ClaimContestRemoved as ClaimContestRemovedEvent,
  LegacyAuthUsed as LegacyAuthUsedEvent,
} from "../generated/InsuranceClaimFacet/InsuranceClaimFacet";
import {
  loadCircleAdminCALR,
  loadInsuranceClaim,
  newCALRActivity,
  newInsuranceClaimContestActivity,
  recordLegacyAuthUsed,
} from "./lib";
import {
  AUTH_SOURCE_INSURANCE_DIAMOND,
  CONTEST_ACTION_CONTESTED,
  CONTEST_ACTION_REMOVED,
} from "./constants/roles";
import {
  REJECTION_KIND_APPROVER_CANCEL,
  REJECTION_KIND_REVIEWER,
  REJECTION_KIND_SUPER_ADMIN,
} from "./constants/insurance-claim";

export function handleClaimSubmitted(event: ClaimSubmittedEvent): void {
  const claim = event.params.claim;

  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  entity.claimId = event.params.claimId;
  entity.circleId = event.params.circleId;
  entity.circle = Bytes.fromByteArray(Bytes.fromBigInt(event.params.circleId));
  entity.claimant = event.params.claimant;
  entity.beneficiary = claim.beneficiary;

  entity.claimType = claim.claimType;
  entity.status = claim.status;

  entity.fiatAmount = claim.fiatAmount;
  entity.usdcAmount = claim.usdcAmount;
  entity.accountNo = claim.accountNo;

  entity.orderId = claim.orderId;
  entity.order = Bytes.fromByteArray(Bytes.fromBigInt(claim.orderId));

  entity.merchant = event.params.claimant;

  entity.currency = Bytes.fromByteArray(claim.currency);
  entity.submittedAt = claim.submittedAt;
  entity.reviewedAt = claim.reviewedAt;
  entity.resolver = claim.resolver;

  entity.requiresSuperAdminApproval = claim.requiresSuperAdminApproval;
  entity.superAdminApproved = claim.superAdminApproved;
  entity.isCustomClaim = claim.isCustomClaim;
  entity.amendCount = claim.amendCount;
  entity.metadataURI = claim.metadataURI;
  entity.circleAdminAtSubmit = claim.circleAdminAtSubmit;
  entity.beneficiaryIsMerchant = claim.beneficiaryIsMerchant;

  entity.save();
}

export function handleClaimApproved(event: ClaimApprovedEvent): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  // ClaimStatus.APPROVED = 2
  entity.status = 2;
  entity.resolver = event.params.resolver;
  entity.reviewedAt = event.block.timestamp;
  entity.payoutEligibleAt = event.params.payoutEligibleAt;

  entity.save();
}

export function handleClaimRejected(event: ClaimRejectedEvent): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  // ClaimStatus.REJECTED = 3
  entity.status = 3;
  entity.rejectionKind = REJECTION_KIND_REVIEWER;
  entity.resolver = event.params.resolver;
  entity.reviewedAt = event.block.timestamp;

  entity.save();
}

// APPROVED -> REJECTED teardown, shared by the super-admin escape hatch and the
// approver-level cancel. On-chain both routes run the same private
// `_tearDownApprovedClaim`, which also wipes the contest record so a dead claim
// cannot leave a stale contested flag behind; mirroring it in one place here
// keeps the two mappings from drifting the way the contract refuses to.
function tearDownApprovedClaim(
  claimId: BigInt,
  resolver: Bytes,
  rejectionKind: i32,
  event: ethereum.Event,
): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(claimId)),
    event,
  );

  // ClaimStatus.REJECTED = 3
  entity.status = 3;
  entity.rejectionKind = rejectionKind;
  entity.resolver = resolver;
  entity.reviewedAt = event.block.timestamp;
  // The teardown clears the contest record: contested, who contested, and the
  // payout clock all go back to zero.
  entity.contested = false;
  entity.contestedBy = null;
  entity.contestedAt = null;
  entity.payoutEligibleAt = BigInt.zero();

  entity.save();
}

// Super admin force-rejects a claim that had already reached APPROVED. The
// contract emits this distinct event (not ClaimRejected) for the
// APPROVED -> REJECTED escape hatch, so the claim still lands in REJECTED.
export function handleClaimForceRejected(event: ClaimForceRejectedEvent): void {
  tearDownApprovedClaim(
    event.params.claimId,
    event.params.superAdmin,
    REJECTION_KIND_SUPER_ADMIN,
    event,
  );
}

// A currency approver reverses a claim that had already reached APPROVED. Same
// APPROVED -> REJECTED transition as the force-reject above, but approver-level
// rather than the super-admin escape hatch, so the two stay apart in
// rejectionKind. `approver` is whoever cancelled, which need not be the
// approver who approved it. Without this handler a cancelled claim would sit at
// APPROVED in the index forever.
export function handleApprovedClaimCancelled(
  event: ApprovedClaimCancelledEvent,
): void {
  tearDownApprovedClaim(
    event.params.claimId,
    event.params.approver,
    REJECTION_KIND_APPROVER_CANCEL,
    event,
  );
}

export function handleClaimWithdrawn(event: ClaimWithdrawnEvent): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  // ClaimStatus.WITHDRAWN = 5
  entity.status = 5;
  entity.reviewedAt = event.block.timestamp;

  entity.save();
}

export function handleClaimSettled(event: ClaimSettledEvent): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  // ClaimStatus.SETTLED = 4
  entity.status = 4;
  entity.settledAt = event.block.timestamp;
  entity.settledUsdcAmount = event.params.usdcAmount;
  entity.fromCAIP = event.params.fromCAIP;
  entity.fromCALR = event.params.fromCALR;

  entity.save();

  // Settlement drains the snapshot admin's CALR.locked bucket (never a
  // successor's) — attribute the drained amount to that admin's CALR ledger.
  // The guard skips claims submitted before this data source's startBlock,
  // whose circleAdminAtSubmit was never populated.
  const fromCALR = event.params.fromCALR;
  if (fromCALR.gt(BigInt.zero()) && entity.circleAdminAtSubmit.length > 0) {
    const admin = entity.circleAdminAtSubmit;
    const calr = loadCircleAdminCALR(admin, event);
    calr.totalSettled = calr.totalSettled.plus(fromCALR);
    calr.save();

    const activity = newCALRActivity(
      event,
      admin,
      "SETTLEMENT_DRAIN",
      fromCALR,
    );
    activity.claimId = event.params.claimId;
    activity.save();
  }
}

export function handleSuperAdminLargeClaimApproved(
  event: SuperAdminLargeClaimApprovedEvent,
): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  entity.superAdminApproved = true;

  entity.save();
}

// ─────────────────────────── R6 Ops contest window ───────────────────────

export function handleClaimContested(event: ClaimContestedEvent): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  entity.contested = true;
  entity.contestedBy = event.params.by;
  entity.contestedAt = event.block.timestamp;
  entity.contestCount += 1;
  entity.save();

  newInsuranceClaimContestActivity(
    event,
    event.params.claimId,
    CONTEST_ACTION_CONTESTED,
    event.params.by,
  ).save();
}

export function handleClaimContestRemoved(
  event: ClaimContestRemovedEvent,
): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  // Removal is a positive re-clearance: a FRESH 48h window starts.
  entity.contested = false;
  entity.payoutEligibleAt = event.params.newEligibleAt;
  entity.save();

  const activity = newInsuranceClaimContestActivity(
    event,
    event.params.claimId,
    CONTEST_ACTION_REMOVED,
    event.params.by,
  );
  activity.newEligibleAt = event.params.newEligibleAt;
  activity.save();
}

// Same signature and topic as the main Diamond's LibAuth event, emitted from
// the Insurance Diamond address on legacy-only authorizations.
export function handleLegacyAuthUsed(event: LegacyAuthUsedEvent): void {
  recordLegacyAuthUsed(
    event,
    AUTH_SOURCE_INSURANCE_DIAMOND,
    event.params.caller,
    event.params.selector,
  );
}
