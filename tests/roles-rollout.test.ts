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
  CountryActiveSet,
  CurrencyCountryBound,
} from "../generated/CountryFacet/CountryFacet";
import {
  AdminStatusUpdated,
  SuperAdminUpdated,
} from "../generated/SetterFacet/SetterFacet";
import { GlobalAdminUpdated } from "../generated/CapabilityFacet/CapabilityFacet";
import { EmergencyPauseSet } from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import {
  ClaimContested,
  ClaimContestRemoved,
  LegacyAuthUsed as InsuranceLegacyAuthUsed,
} from "../generated/InsuranceClaimFacet/InsuranceClaimFacet";
import {
  BlacklistRateLimitSet,
  LegacyAuthUsed as RmLegacyAuthUsed,
} from "../generated/ReputationManager/ReputationManager";
import { CircleAdminP2PStakeReturned } from "../generated/CircleFacet/CircleFacet";
import { NonPoolTokenSwept } from "../generated/InsurancePoolFacet/InsurancePoolFacet";
import { OwnershipTransferred } from "../generated/DiamondOwnership/OwnershipFacet";
import {
  CallExecuted,
  CallSalt,
  CallScheduled,
  Cancelled,
  MinDelayChange,
} from "../generated/templates/LeadTimelock/LeadTimelock";
import {
  handleCountryActiveSet,
  handleCurrencyCountryBound,
} from "../src/country-facet";
import {
  handleAdminStatusUpdated,
  handleSuperAdminUpdated,
} from "../src/setter-facet";
import { handleGlobalAdminUpdated } from "../src/capability";
import { handleEmergencyPauseSet } from "../src/order";
import {
  handleClaimContestRemoved,
  handleClaimContested,
  handleLegacyAuthUsed as handleInsuranceLegacyAuthUsed,
} from "../src/insurance-claim";
import {
  handleBlacklistRateLimitSet,
  handleLegacyAuthUsed as handleRmLegacyAuthUsed,
} from "../src/reputation-manager";
import { handleCircleAdminP2PStakeReturned } from "../src/circle-facet";
import { handleNonPoolTokenSwept } from "../src/insurance-pool";
import { handleOwnershipTransferred } from "../src/ownership";
import {
  handleCallExecuted,
  handleCallSalt,
  handleCallScheduled,
  handleCancelled,
  handleMinDelayChange,
} from "../src/lead-timelock";
import { loadInsuranceClaim } from "../src/lib";

const OPERATOR = Address.fromString(
  "0x0000000000000000000000000000000000000001",
);
const ALICE = Address.fromString("0x000000000000000000000000000000000000000a");
const DIAMOND = Address.fromString(
  "0x4cad6eC90e65baBec9335cAd728DDC610c316368",
);
const INSURANCE = Address.fromString(
  "0x17192bd2E8893E4eA0Ab5DB67AdbF38aE42e9931",
);
const RM = Address.fromString("0xCF613e08EE1B4c2669DdCf06A7d22c9856f6Aa1D");
const TIMELOCK = Address.fromString(
  "0x00000000000000000000000000000000000000c1",
);

const COUNTRY_IN = Bytes.fromHexString(
  "0x494e00000000000000000000000000000000000000000000000000000000000000",
);
const CURRENCY_INR = Bytes.fromHexString(
  "0x494e520000000000000000000000000000000000000000000000000000000000",
);
const OP_ID = Bytes.fromHexString(
  "0x2222222222222222222222222222222222222222222222222222222222222222",
);
const ZERO32 = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000000000000000000000000000",
);
// grantRole(uint8,address) calldata: selector + two words
const GRANT_CALLDATA = Bytes.fromHexString(
  "0x5d5664e1" +
    "0000000000000000000000000000000000000000000000000000000000000000" +
    "000000000000000000000000000000000000000000000000000000000000000a",
);
const AUTH_ID = Bytes.fromUTF8("auth").toHexString();

function scheduled(index: i32, delay: i32): CallScheduled {
  const e = baseEvent<CallScheduled>(TIMELOCK);
  e.parameters.push(param("id", ethereum.Value.fromFixedBytes(OP_ID)));
  e.parameters.push(
    param("index", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(index))),
  );
  e.parameters.push(param("target", ethereum.Value.fromAddress(DIAMOND)));
  e.parameters.push(
    param("value", ethereum.Value.fromUnsignedBigInt(BigInt.zero())),
  );
  e.parameters.push(param("data", ethereum.Value.fromBytes(GRANT_CALLDATA)));
  e.parameters.push(
    param("predecessor", ethereum.Value.fromFixedBytes(ZERO32)),
  );
  e.parameters.push(
    param("delay", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(delay))),
  );
  return e;
}

function executed(index: i32): CallExecuted {
  const e = baseEvent<CallExecuted>(TIMELOCK);
  e.parameters.push(param("id", ethereum.Value.fromFixedBytes(OP_ID)));
  e.parameters.push(
    param("index", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(index))),
  );
  e.parameters.push(param("target", ethereum.Value.fromAddress(DIAMOND)));
  e.parameters.push(
    param("value", ethereum.Value.fromUnsignedBigInt(BigInt.zero())),
  );
  e.parameters.push(param("data", ethereum.Value.fromBytes(GRANT_CALLDATA)));
  return e;
}

let nextLogIndex = 0;

function baseEvent<T extends ethereum.Event>(address: Address): T {
  const mock = newMockEvent();
  const e = changetype<T>(mock);
  e.address = address;
  // Distinct log ids so immutable log rows never collide across events.
  e.logIndex = BigInt.fromI32(nextLogIndex++);
  e.parameters = new Array<ethereum.EventParam>();
  return e;
}

function param(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

describe("CountryFacet — R5 country scope", () => {
  afterEach(() => {
    clearStore();
  });

  test("activation and currency binding", () => {
    const a = baseEvent<CountryActiveSet>(DIAMOND);
    a.parameters.push(
      param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
    );
    a.parameters.push(param("active", ethereum.Value.fromBoolean(true)));
    handleCountryActiveSet(a);

    const b = baseEvent<CurrencyCountryBound>(DIAMOND);
    b.parameters.push(
      param("currency", ethereum.Value.fromFixedBytes(CURRENCY_INR)),
    );
    b.parameters.push(
      param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
    );
    b.parameters.push(
      param("previousCountry", ethereum.Value.fromFixedBytes(ZERO32)),
    );
    handleCurrencyCountryBound(b);

    const countryId = COUNTRY_IN.toHexString();
    assert.fieldEquals("Country", countryId, "isActive", "true");
    assert.fieldEquals("Country", countryId, "code", "IN");
    assert.fieldEquals(
      "Currency",
      CURRENCY_INR.toHexString(),
      "country",
      countryId,
    );
  });
});

describe("Legacy admin stores", () => {
  afterEach(() => {
    clearStore();
  });

  test("super admin, admin and global admin flags are tracked per account", () => {
    const s = baseEvent<SuperAdminUpdated>(DIAMOND);
    s.parameters.push(param("updater", ethereum.Value.fromAddress(OPERATOR)));
    s.parameters.push(
      param("updatedAddress", ethereum.Value.fromAddress(ALICE)),
    );
    s.parameters.push(param("status", ethereum.Value.fromBoolean(true)));
    handleSuperAdminUpdated(s);

    const a = baseEvent<AdminStatusUpdated>(DIAMOND);
    a.parameters.push(param("admin", ethereum.Value.fromAddress(ALICE)));
    a.parameters.push(param("status", ethereum.Value.fromBoolean(true)));
    handleAdminStatusUpdated(a);

    const g = baseEvent<GlobalAdminUpdated>(DIAMOND);
    g.parameters.push(param("updater", ethereum.Value.fromAddress(OPERATOR)));
    g.parameters.push(param("account", ethereum.Value.fromAddress(ALICE)));
    g.parameters.push(param("status", ethereum.Value.fromBoolean(true)));
    handleGlobalAdminUpdated(g);

    const id = ALICE.toHexString();
    assert.fieldEquals("LegacyAdmin", id, "isSuperAdmin", "true");
    assert.fieldEquals("LegacyAdmin", id, "isAdmin", "true");
    assert.fieldEquals("LegacyAdmin", id, "isGlobalAdmin", "true");

    // R8 RetirementInit replays the same events with status=false.
    const r = baseEvent<SuperAdminUpdated>(DIAMOND);
    r.parameters.push(param("updater", ethereum.Value.fromAddress(OPERATOR)));
    r.parameters.push(
      param("updatedAddress", ethereum.Value.fromAddress(ALICE)),
    );
    r.parameters.push(param("status", ethereum.Value.fromBoolean(false)));
    handleSuperAdminUpdated(r);
    assert.fieldEquals("LegacyAdmin", id, "isSuperAdmin", "false");
    assert.fieldEquals("LegacyAdmin", id, "isAdmin", "true");
    assert.entityCount("LegacyAdmin", 1);
  });
});

describe("OrderProcessorFacet — R7 emergency pause", () => {
  afterEach(() => {
    clearStore();
  });

  test("toggle updates the state and logs activity", () => {
    const on = baseEvent<EmergencyPauseSet>(DIAMOND);
    on.parameters.push(param("by", ethereum.Value.fromAddress(OPERATOR)));
    on.parameters.push(param("paused", ethereum.Value.fromBoolean(true)));
    handleEmergencyPauseSet(on);
    assert.fieldEquals("ProtocolAuthState", AUTH_ID, "emergencyPaused", "true");
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "emergencyPausedBy",
      OPERATOR.toHexString(),
    );

    const off = baseEvent<EmergencyPauseSet>(DIAMOND);
    off.logIndex = BigInt.fromI32(2);
    off.parameters.push(param("by", ethereum.Value.fromAddress(OPERATOR)));
    off.parameters.push(param("paused", ethereum.Value.fromBoolean(false)));
    handleEmergencyPauseSet(off);
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "emergencyPaused",
      "false",
    );
    assert.entityCount("EmergencyPauseActivity", 2);
  });
});

describe("InsuranceClaimFacet — R6 contest window", () => {
  afterEach(() => {
    clearStore();
  });

  test("contest freezes the claim; removal restarts the window", () => {
    const claimId = BigInt.fromI32(7);
    const claimKey = Bytes.fromByteArray(Bytes.fromBigInt(claimId));
    const seed = baseEvent<ClaimContested>(INSURANCE);
    const claim = loadInsuranceClaim(claimKey, seed);
    claim.claimId = claimId;
    claim.status = 2;
    claim.payoutEligibleAt = BigInt.fromI32(1000);
    claim.save();

    const c = baseEvent<ClaimContested>(INSURANCE);
    c.parameters.push(
      param("claimId", ethereum.Value.fromUnsignedBigInt(claimId)),
    );
    c.parameters.push(param("by", ethereum.Value.fromAddress(OPERATOR)));
    handleClaimContested(c);

    const id = claimKey.toHexString();
    assert.fieldEquals("InsuranceClaim", id, "contested", "true");
    assert.fieldEquals(
      "InsuranceClaim",
      id,
      "contestedBy",
      OPERATOR.toHexString(),
    );
    assert.fieldEquals("InsuranceClaim", id, "contestCount", "1");
    assert.fieldEquals("InsuranceClaim", id, "payoutEligibleAt", "1000");

    const r = baseEvent<ClaimContestRemoved>(INSURANCE);
    r.logIndex = BigInt.fromI32(2);
    r.parameters.push(
      param("claimId", ethereum.Value.fromUnsignedBigInt(claimId)),
    );
    r.parameters.push(param("by", ethereum.Value.fromAddress(OPERATOR)));
    r.parameters.push(
      param(
        "newEligibleAt",
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(5000)),
      ),
    );
    handleClaimContestRemoved(r);

    assert.fieldEquals("InsuranceClaim", id, "contested", "false");
    assert.fieldEquals("InsuranceClaim", id, "payoutEligibleAt", "5000");
    assert.fieldEquals("InsuranceClaim", id, "contestCount", "1");
    assert.entityCount("InsuranceClaimContestActivity", 2);
  });
});

describe("LegacyAuthUsed — the other two emission points", () => {
  afterEach(() => {
    clearStore();
  });

  test("insurance and reputation-manager emissions are attributed to their source", () => {
    const sel = Bytes.fromHexString("0x1c72c7b6");
    const i = baseEvent<InsuranceLegacyAuthUsed>(INSURANCE);
    i.parameters.push(param("caller", ethereum.Value.fromAddress(ALICE)));
    i.parameters.push(param("selector", ethereum.Value.fromFixedBytes(sel)));
    handleInsuranceLegacyAuthUsed(i);

    const r = baseEvent<RmLegacyAuthUsed>(RM);
    r.logIndex = BigInt.fromI32(2);
    r.parameters.push(param("caller", ethereum.Value.fromAddress(ALICE)));
    r.parameters.push(param("selector", ethereum.Value.fromFixedBytes(sel)));
    handleRmLegacyAuthUsed(r);

    assert.entityCount("LegacyAuthUsage", 2);
    assert.fieldEquals(
      "LegacyAuthSelectorStats",
      INSURANCE.concat(sel).toHexString(),
      "source",
      "INSURANCE_DIAMOND",
    );
    assert.fieldEquals(
      "LegacyAuthSelectorStats",
      RM.concat(sel).toHexString(),
      "source",
      "REPUTATION_MANAGER",
    );
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "legacyAuthUsedCount",
      "2",
    );
  });
});

describe("LeadTimelock — R7 timelock operations", () => {
  afterEach(() => {
    clearStore();
  });

  test("a two-call batch is pending until both calls execute", () => {
    handleCallScheduled(scheduled(0, 172800));
    handleCallScheduled(scheduled(1, 172800));

    const opId = TIMELOCK.concat(OP_ID).toHexString();
    assert.fieldEquals("TimelockOperation", opId, "status", "PENDING");
    assert.fieldEquals("TimelockOperation", opId, "callCount", "2");
    assert.fieldEquals("TimelockOperation", opId, "readyAt", "172801");
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "operationCount",
      "1",
    );
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "pendingCount",
      "1",
    );

    const callId = TIMELOCK.concat(OP_ID).concatI32(1).toHexString();
    assert.fieldEquals("TimelockCall", callId, "selector", "0x5d5664e1");
    assert.fieldEquals(
      "TimelockCall",
      callId,
      "functionName",
      "RoleAdminFacet.grantRole(uint8,address)",
    );

    const salt = baseEvent<CallSalt>(TIMELOCK);
    salt.parameters.push(param("id", ethereum.Value.fromFixedBytes(OP_ID)));
    salt.parameters.push(param("salt", ethereum.Value.fromFixedBytes(ZERO32)));
    handleCallSalt(salt);
    assert.fieldEquals("TimelockOperation", opId, "salt", ZERO32.toHexString());

    handleCallExecuted(executed(0));
    assert.fieldEquals("TimelockOperation", opId, "status", "PENDING");
    assert.fieldEquals("TimelockOperation", opId, "executedCallCount", "1");
    handleCallExecuted(executed(1));
    assert.fieldEquals("TimelockOperation", opId, "status", "EXECUTED");
    assert.fieldEquals("TimelockCall", callId, "executed", "true");
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "pendingCount",
      "0",
    );
  });

  test("cancel and min-delay change", () => {
    handleCallScheduled(scheduled(0, 172800));
    const c = baseEvent<Cancelled>(TIMELOCK);
    c.parameters.push(param("id", ethereum.Value.fromFixedBytes(OP_ID)));
    handleCancelled(c);

    const opId = TIMELOCK.concat(OP_ID).toHexString();
    assert.fieldEquals("TimelockOperation", opId, "status", "CANCELLED");
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "pendingCount",
      "0",
    );

    const d = baseEvent<MinDelayChange>(TIMELOCK);
    d.parameters.push(
      param("oldDuration", ethereum.Value.fromUnsignedBigInt(BigInt.zero())),
    );
    d.parameters.push(
      param(
        "newDuration",
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(172800)),
      ),
    );
    handleMinDelayChange(d);
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "minDelay",
      "172800",
    );
  });
});

describe("R1 fund custody", () => {
  afterEach(() => {
    clearStore();
  });

  test("circle-admin stake return and non-pool token sweep are logged", () => {
    const r = baseEvent<CircleAdminP2PStakeReturned>(DIAMOND);
    r.parameters.push(param("caller", ethereum.Value.fromAddress(OPERATOR)));
    r.parameters.push(param("circleAdmin", ethereum.Value.fromAddress(ALICE)));
    r.parameters.push(
      param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500))),
    );
    handleCircleAdminP2PStakeReturned(r);
    assert.entityCount("CircleAdminP2PStakeReturn", 1);
    assert.fieldEquals(
      "CircleAdminP2PStakeReturn",
      r.transaction.hash.concatI32(r.logIndex.toI32()).toHexString(),
      "amount",
      "500",
    );

    const s = baseEvent<NonPoolTokenSwept>(INSURANCE);
    s.parameters.push(param("token", ethereum.Value.fromAddress(ALICE)));
    s.parameters.push(param("to", ethereum.Value.fromAddress(OPERATOR)));
    s.parameters.push(
      param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9))),
    );
    handleNonPoolTokenSwept(s);
    assert.fieldEquals(
      "InsuranceNonPoolTokenSweep",
      s.transaction.hash.concatI32(s.logIndex.toI32()).toHexString(),
      "to",
      OPERATOR.toHexString(),
    );
  });
});

describe("R4 blacklist rate limit", () => {
  afterEach(() => {
    clearStore();
  });

  test("is stored on the auth state singleton", () => {
    const e = baseEvent<BlacklistRateLimitSet>(RM);
    e.parameters.push(
      param(
        "windowSeconds",
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3600)),
      ),
    );
    e.parameters.push(
      param(
        "maxPerWindow",
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(20)),
      ),
    );
    handleBlacklistRateLimitSet(e);
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "blacklistWindowSeconds",
      "3600",
    );
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "blacklistMaxPerWindow",
      "20",
    );
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "legacyAuthEnabled",
      "true",
    );
  });
});

describe("Diamond ownership — R7 WS-3.5", () => {
  afterEach(() => {
    clearStore();
  });

  test("tracks the current owner per diamond", () => {
    const e = baseEvent<OwnershipTransferred>(DIAMOND);
    e.parameters.push(
      param("previousOwner", ethereum.Value.fromAddress(OPERATOR)),
    );
    e.parameters.push(param("newOwner", ethereum.Value.fromAddress(TIMELOCK)));
    handleOwnershipTransferred(e);

    const i = baseEvent<OwnershipTransferred>(INSURANCE);
    i.parameters.push(
      param("previousOwner", ethereum.Value.fromAddress(OPERATOR)),
    );
    i.parameters.push(param("newOwner", ethereum.Value.fromAddress(ALICE)));
    handleOwnershipTransferred(i);

    assert.fieldEquals(
      "DiamondOwnership",
      DIAMOND.toHexString(),
      "owner",
      TIMELOCK.toHexString(),
    );
    assert.fieldEquals(
      "DiamondOwnership",
      DIAMOND.toHexString(),
      "transferCount",
      "1",
    );
    assert.fieldEquals(
      "DiamondOwnership",
      INSURANCE.toHexString(),
      "owner",
      ALICE.toHexString(),
    );
    assert.entityCount("DiamondOwnershipTransfer", 2);
  });
});

describe("LeadTimelock — reschedule after cancel", () => {
  afterEach(() => {
    clearStore();
  });

  test("the same operation id scheduled again after Cancelled is pending once more", () => {
    handleCallScheduled(scheduled(0, 172800));
    const c = baseEvent<Cancelled>(TIMELOCK);
    c.parameters.push(param("id", ethereum.Value.fromFixedBytes(OP_ID)));
    handleCancelled(c);

    handleCallScheduled(scheduled(0, 172800));

    const opId = TIMELOCK.concat(OP_ID).toHexString();
    assert.fieldEquals("TimelockOperation", opId, "status", "PENDING");
    assert.fieldEquals("TimelockOperation", opId, "callCount", "1");
    assert.fieldEquals("TimelockOperation", opId, "executedCallCount", "0");
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "operationCount",
      "1",
    );
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "pendingCount",
      "1",
    );

    handleCallExecuted(executed(0));
    assert.fieldEquals("TimelockOperation", opId, "status", "EXECUTED");
    assert.fieldEquals(
      "LeadTimelock",
      TIMELOCK.toHexString(),
      "pendingCount",
      "0",
    );
  });
});
