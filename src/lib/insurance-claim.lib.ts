import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { InsuranceClaim } from "../../generated/schema";

export function loadInsuranceClaim(
  key: Bytes,
  event: ethereum.Event,
): InsuranceClaim {
  let claim = InsuranceClaim.load(key);
  if (!claim) {
    claim = new InsuranceClaim(key);
    claim.claimId = BigInt.zero();
    claim.circleId = BigInt.zero();
    claim.circle = Bytes.fromByteArray(Bytes.fromBigInt(BigInt.zero()));
    claim.claimant = Bytes.empty();
    claim.claimType = 0;
    claim.status = 0;
    claim.fiatAmount = BigInt.zero();
    claim.usdcAmount = BigInt.zero();
    claim.accountNo = BigInt.zero();
    claim.orderId = BigInt.zero();
    claim.order = Bytes.fromByteArray(Bytes.fromBigInt(BigInt.zero()));
    claim.merchant = null;
    claim.currency = Bytes.empty();
    claim.submittedAt = BigInt.zero();
    claim.reviewedAt = BigInt.zero();
    claim.resolver = Bytes.empty();
    claim.requiresSuperAdminApproval = false;
    claim.superAdminApproved = false;
    claim.payoutEligibleAt = BigInt.zero();
  }

  claim.blockNumber = event.block.number;
  claim.blockTimestamp = event.block.timestamp;
  claim.transactionHash = event.transaction.hash;

  return claim;
}
