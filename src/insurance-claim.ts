import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ClaimSubmitted as ClaimSubmittedEvent,
  ClaimApproved as ClaimApprovedEvent,
  ClaimRejected as ClaimRejectedEvent,
  SuperAdminLargeClaimApproved as SuperAdminLargeClaimApprovedEvent,
} from "../generated/InsuranceClaimFacet/InsuranceClaimFacet";
import { loadInsuranceClaim } from "./lib";

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
