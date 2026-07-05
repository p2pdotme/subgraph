import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ClaimSubmitted as ClaimSubmittedEvent,
  ClaimApproved as ClaimApprovedEvent,
  ClaimRejected as ClaimRejectedEvent,
  ClaimForceRejected as ClaimForceRejectedEvent,
  ClaimWithdrawn as ClaimWithdrawnEvent,
  ClaimSettled as ClaimSettledEvent,
  SuperAdminLargeClaimApproved as SuperAdminLargeClaimApprovedEvent,
} from "../generated/InsuranceClaimFacet/InsuranceClaimFacet";
import {
  loadCircleAdminCALR,
  loadInsuranceClaim,
  newCALRActivity,
} from "./lib";

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
  entity.resolver = event.params.resolver;
  entity.reviewedAt = event.block.timestamp;

  entity.save();
}

// Super admin force-rejects a claim that had already reached APPROVED. The
// contract emits this distinct event (not ClaimRejected) for the
// APPROVED -> REJECTED escape hatch, so the claim still lands in REJECTED.
export function handleClaimForceRejected(event: ClaimForceRejectedEvent): void {
  const entity = loadInsuranceClaim(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.claimId)),
    event,
  );

  // ClaimStatus.REJECTED = 3
  entity.status = 3;
  entity.resolver = event.params.superAdmin;
  entity.reviewedAt = event.block.timestamp;

  entity.save();
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

    const activity = newCALRActivity(event, admin, "SETTLEMENT_DRAIN", fromCALR);
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
