import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  ClaimContested,
  ContestExpiredClaimRejected,
} from "../generated/InsuranceClaimFacet/InsuranceClaimFacet";
import {
  handleClaimContested,
  handleContestExpiredClaimRejected,
} from "../src/insurance-claim";
import { loadInsuranceClaim } from "../src/lib";

// contracts-v4 #464 InsuranceClaimFacet.rejectExpiredContest: once a contest
// has stood CONTEST_MAX_DURATION anyone may finalise it. It emits ONLY
// ContestExpiredClaimRejected (not ClaimRejected), tears the APPROVED claim
// down and sets resolver to the contesting Ops Lead, not the caller.
const INSURANCE = Address.fromString("0x17192bd2e8893e4ea0ab5db67adbf38ae42e9931");
const OPS_LEAD = Address.fromString("0x000000000000000000000000000000000000000c");
const ANYONE = Address.fromString("0x000000000000000000000000000000000000000d");

function param(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

function event<T extends ethereum.Event>(ts: i32, logIndex: i32): T {
  const m = newMockEvent();
  m.address = INSURANCE;
  m.block.timestamp = BigInt.fromI32(ts);
  m.logIndex = BigInt.fromI32(logIndex);
  const e = changetype<T>(m);
  e.parameters = new Array<ethereum.EventParam>();
  return e;
}

describe("InsuranceClaimFacet — contest expiry", () => {
  afterEach(() => {
    clearStore();
  });

  test("an expired contest rejects the claim, resolver is the Ops Lead", () => {
    const claimId = BigInt.fromI32(21);
    const key = Bytes.fromByteArray(Bytes.fromBigInt(claimId));
    const seed = event<ClaimContested>(100, 0);
    const claim = loadInsuranceClaim(key, seed);
    claim.claimId = claimId;
    claim.status = 2; // APPROVED
    claim.payoutEligibleAt = BigInt.fromI32(1000);
    claim.save();

    const c = event<ClaimContested>(200, 1);
    c.parameters.push(param("claimId", ethereum.Value.fromUnsignedBigInt(claimId)));
    c.parameters.push(param("by", ethereum.Value.fromAddress(OPS_LEAD)));
    handleClaimContested(c);

    const x = event<ContestExpiredClaimRejected>(900_000, 2);
    x.parameters.push(param("claimId", ethereum.Value.fromUnsignedBigInt(claimId)));
    x.parameters.push(param("circleId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3))));
    x.parameters.push(param("contestedBy", ethereum.Value.fromAddress(OPS_LEAD)));
    x.parameters.push(param("by", ethereum.Value.fromAddress(ANYONE)));
    handleContestExpiredClaimRejected(x);

    const id = key.toHexString();
    assert.fieldEquals("InsuranceClaim", id, "status", "3");
    assert.fieldEquals("InsuranceClaim", id, "rejectionKind", "4");
    assert.fieldEquals("InsuranceClaim", id, "resolver", OPS_LEAD.toHexString());
    assert.fieldEquals("InsuranceClaim", id, "reviewedAt", "900000");
    assert.fieldEquals("InsuranceClaim", id, "contested", "false");
    assert.fieldEquals("InsuranceClaim", id, "payoutEligibleAt", "0");
    assert.entityCount("InsuranceClaimContestActivity", 2);
  });
});
