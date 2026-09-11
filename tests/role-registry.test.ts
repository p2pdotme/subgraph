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
  CoSignCancelled,
  CoSignProposed,
  CountryAssigned,
  LegacyAuthToggled,
  LegacyAuthUsed,
  LegacyExemptSet,
  RoleGranted,
  RoleRevoked,
  RoleTimelockSet,
  SelectorPolicyCleared,
  SelectorPolicySet,
} from "../generated/RoleAdminFacet/RoleAdminFacet";
import { CoSignConsumed } from "../generated/B2BGatewayFacet/B2BGatewayFacet";
import {
  handleCoSignCancelled,
  handleCoSignProposed,
  handleCountryAssigned,
  handleLegacyAuthToggled,
  handleLegacyAuthUsed,
  handleLegacyExemptSet,
  handleRoleGranted,
  handleRoleRevoked,
  handleRoleTimelockSet,
  handleSelectorPolicyCleared,
  handleSelectorPolicySet,
} from "../src/role-registry";
import { handleCoSignConsumed } from "../src/b2b-gateway";
import { roleMemberId, protocolRoleId } from "../src/lib/role-registry.lib";

const OPERATOR = Address.fromString(
  "0x0000000000000000000000000000000000000001",
);
const ALICE = Address.fromString("0x000000000000000000000000000000000000000a");
const BOB = Address.fromString("0x000000000000000000000000000000000000000b");
const TIMELOCK = Address.fromString(
  "0x00000000000000000000000000000000000000c1",
);
const DIAMOND = Address.fromString(
  "0x4cad6eC90e65baBec9335cAd728DDC610c316368",
);

// RoleAdminFacet.grantRole(uint8,address)
const GRANT_ROLE_SELECTOR = Bytes.fromHexString("0x5d5664e1");
// OrderProcessorFacet.emergencyPause(bool)
const EMERGENCY_PAUSE_SELECTOR = Bytes.fromHexString("0x2b34d55e");
const COUNTRY_IN = Bytes.fromHexString(
  "0x494e00000000000000000000000000000000000000000000000000000000000000",
);
const KEY = Bytes.fromHexString(
  "0x1111111111111111111111111111111111111111111111111111111111111111",
);

const ROLE_DEV_LEAD = 0;
const ROLE_OPS_LEAD = 1;
const ROLE_ADMIN = 4;

let nextLogIndex = 0;

function baseEvent<T extends ethereum.Event>(): T {
  const mock = newMockEvent();
  const e = changetype<T>(mock);
  e.address = DIAMOND;
  // Distinct log ids so immutable log rows never collide across events.
  e.logIndex = BigInt.fromI32(nextLogIndex++);
  e.parameters = new Array<ethereum.EventParam>();
  return e;
}

function param(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

function roleEvent<T extends ethereum.Event>(role: i32, account: Address): T {
  const e = baseEvent<T>();
  e.parameters.push(param("operator", ethereum.Value.fromAddress(OPERATOR)));
  e.parameters.push(param("role", ethereum.Value.fromI32(role)));
  e.parameters.push(param("account", ethereum.Value.fromAddress(account)));
  return e;
}

function policyEvent(
  selector: Bytes,
  roleMask: i32,
  scope: i32,
  tier: i32,
  timelocked: boolean,
  dualSign: boolean,
  coSignRoleMask: i32,
): SelectorPolicySet {
  const e = baseEvent<SelectorPolicySet>();
  e.parameters.push(param("selector", ethereum.Value.fromFixedBytes(selector)));
  const tuple = changetype<ethereum.Tuple>([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(roleMask)),
    ethereum.Value.fromBoolean(false),
    ethereum.Value.fromI32(scope),
    ethereum.Value.fromI32(tier),
    ethereum.Value.fromBoolean(timelocked),
    ethereum.Value.fromBoolean(dualSign),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(coSignRoleMask)),
    ethereum.Value.fromBoolean(true),
  ]);
  e.parameters.push(param("policy", ethereum.Value.fromTuple(tuple)));
  return e;
}

function selectorEvent<T extends ethereum.Event>(selector: Bytes): T {
  const e = baseEvent<T>();
  e.parameters.push(param("selector", ethereum.Value.fromFixedBytes(selector)));
  return e;
}

const AUTH_ID = Bytes.fromUTF8("auth").toHexString();

function proposeCoSign(): void {
  const e = baseEvent<CoSignProposed>();
  e.parameters.push(
    param("selector", ethereum.Value.fromFixedBytes(GRANT_ROLE_SELECTOR)),
  );
  e.parameters.push(param("key", ethereum.Value.fromFixedBytes(KEY)));
  e.parameters.push(param("proposer", ethereum.Value.fromAddress(ALICE)));
  e.parameters.push(param("role", ethereum.Value.fromI32(2)));
  e.parameters.push(
    param("expiry", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(604801))),
  );
  handleCoSignProposed(e);
}

describe("RoleAdminFacet — membership", () => {
  afterEach(() => {
    clearStore();
  });

  test("grant creates the role row, the member and counts once", () => {
    handleRoleGranted(roleEvent<RoleGranted>(ROLE_DEV_LEAD, ALICE));
    handleRoleGranted(roleEvent<RoleGranted>(ROLE_DEV_LEAD, ALICE)); // idempotent
    handleRoleGranted(roleEvent<RoleGranted>(ROLE_DEV_LEAD, BOB));

    const roleId = protocolRoleId(ROLE_DEV_LEAD).toHexString();
    assert.fieldEquals("ProtocolRole", roleId, "name", "DEV_LEAD");
    assert.fieldEquals("ProtocolRole", roleId, "memberCount", "2");

    const memberId = roleMemberId(ROLE_DEV_LEAD, ALICE).toHexString();
    assert.fieldEquals("RoleMember", memberId, "isActive", "true");
    assert.fieldEquals("RoleMember", memberId, "roleName", "DEV_LEAD");
    assert.fieldEquals(
      "RoleMember",
      memberId,
      "operator",
      OPERATOR.toHexString(),
    );
    assert.entityCount("RoleActivity", 3);
  });

  test("revoke flips isActive and decrements the count", () => {
    handleRoleGranted(roleEvent<RoleGranted>(ROLE_OPS_LEAD, ALICE));
    handleRoleRevoked(roleEvent<RoleRevoked>(ROLE_OPS_LEAD, ALICE));
    handleRoleRevoked(roleEvent<RoleRevoked>(ROLE_OPS_LEAD, BOB)); // never granted

    const roleId = protocolRoleId(ROLE_OPS_LEAD).toHexString();
    assert.fieldEquals("ProtocolRole", roleId, "memberCount", "0");
    const memberId = roleMemberId(ROLE_OPS_LEAD, ALICE).toHexString();
    assert.fieldEquals("RoleMember", memberId, "isActive", "false");
    assert.fieldEquals("RoleMember", memberId, "revokedAt", "1");
  });

  test("country assignment creates the Country and the AdminCountry link", () => {
    const e = baseEvent<CountryAssigned>();
    e.parameters.push(param("operator", ethereum.Value.fromAddress(OPERATOR)));
    e.parameters.push(param("admin", ethereum.Value.fromAddress(ALICE)));
    e.parameters.push(
      param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
    );
    e.parameters.push(param("assigned", ethereum.Value.fromBoolean(true)));
    handleCountryAssigned(e);

    assert.fieldEquals("Country", COUNTRY_IN.toHexString(), "code", "IN");
    const linkId = ALICE.concat(COUNTRY_IN).toHexString();
    assert.fieldEquals("AdminCountry", linkId, "assigned", "true");
    assert.fieldEquals("AdminCountry", linkId, "countryCode", "IN");

    const off = baseEvent<CountryAssigned>();
    off.parameters.push(
      param("operator", ethereum.Value.fromAddress(OPERATOR)),
    );
    off.parameters.push(param("admin", ethereum.Value.fromAddress(ALICE)));
    off.parameters.push(
      param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
    );
    off.parameters.push(param("assigned", ethereum.Value.fromBoolean(false)));
    handleCountryAssigned(off);
    assert.fieldEquals("AdminCountry", linkId, "assigned", "false");
    assert.fieldEquals("AdminCountry", linkId, "unassignedAt", "1");
  });
});

describe("RoleAdminFacet — selector policies", () => {
  afterEach(() => {
    clearStore();
  });

  test("policy set decodes the struct, expands masks and names the function", () => {
    // roleMask 0b11 = DEV_LEAD | OPS_LEAD; catastrophic, timelocked
    handleSelectorPolicySet(
      policyEvent(GRANT_ROLE_SELECTOR, 3, 0, 2, true, false, 0),
    );

    const id = GRANT_ROLE_SELECTOR.toHexString();
    assert.fieldEquals(
      "SelectorPolicy",
      id,
      "functionName",
      "RoleAdminFacet.grantRole(uint8,address)",
    );
    assert.fieldEquals("SelectorPolicy", id, "roles", "[0, 1]");
    assert.fieldEquals(
      "SelectorPolicy",
      id,
      "roleNames",
      "[DEV_LEAD, OPS_LEAD]",
    );
    assert.fieldEquals("SelectorPolicy", id, "tierName", "CATASTROPHIC");
    assert.fieldEquals("SelectorPolicy", id, "scopeName", "GLOBAL");
    assert.fieldEquals("SelectorPolicy", id, "timelocked", "true");
    assert.fieldEquals("SelectorPolicy", id, "configured", "true");
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "configuredSelectorCount",
      "1",
    );

    // Re-set the same selector: counted once, updateCount grows.
    handleSelectorPolicySet(
      policyEvent(GRANT_ROLE_SELECTOR, 1, 0, 2, true, false, 0),
    );
    assert.fieldEquals("SelectorPolicy", id, "roles", "[0]");
    assert.fieldEquals("SelectorPolicy", id, "updateCount", "2");
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "configuredSelectorCount",
      "1",
    );
  });

  test("dual-sign policy expands the co-sign mask", () => {
    // registerIntegrator: DEV_LEAD executes, MARKETING_LEAD (bit 2) co-signs
    const sel = Bytes.fromHexString("0x36ed9d14");
    handleSelectorPolicySet(policyEvent(sel, 1, 0, 1, false, true, 4));
    const id = sel.toHexString();
    assert.fieldEquals("SelectorPolicy", id, "dualSign", "true");
    assert.fieldEquals(
      "SelectorPolicy",
      id,
      "coSignRoleNames",
      "[MARKETING_LEAD]",
    );
    assert.fieldEquals(
      "SelectorPolicy",
      id,
      "functionName",
      "B2BGatewayFacet.registerIntegrator(address,bool,address)",
    );
  });

  test("clear zeroes the policy but keeps exemption and usage history", () => {
    handleSelectorPolicySet(
      policyEvent(EMERGENCY_PAUSE_SELECTOR, 7, 0, 2, false, false, 0),
    );
    const exempt = selectorEvent<LegacyExemptSet>(EMERGENCY_PAUSE_SELECTOR);
    exempt.parameters.push(param("exempt", ethereum.Value.fromBoolean(true)));
    handleLegacyExemptSet(exempt);

    const used = baseEvent<LegacyAuthUsed>();
    used.parameters.push(param("caller", ethereum.Value.fromAddress(ALICE)));
    used.parameters.push(
      param(
        "selector",
        ethereum.Value.fromFixedBytes(EMERGENCY_PAUSE_SELECTOR),
      ),
    );
    handleLegacyAuthUsed(used);

    handleSelectorPolicyCleared(
      selectorEvent<SelectorPolicyCleared>(EMERGENCY_PAUSE_SELECTOR),
    );

    const id = EMERGENCY_PAUSE_SELECTOR.toHexString();
    assert.fieldEquals("SelectorPolicy", id, "configured", "false");
    assert.fieldEquals("SelectorPolicy", id, "roles", "[]");
    assert.fieldEquals("SelectorPolicy", id, "legacyExempt", "true");
    assert.fieldEquals("SelectorPolicy", id, "legacyAuthUsedCount", "1");
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "configuredSelectorCount",
      "0",
    );
  });
});

describe("RoleAdminFacet — shadow mode", () => {
  afterEach(() => {
    clearStore();
  });

  test("legacy toggle records the flip", () => {
    const e = baseEvent<LegacyAuthToggled>();
    e.parameters.push(param("operator", ethereum.Value.fromAddress(OPERATOR)));
    e.parameters.push(param("enabled", ethereum.Value.fromBoolean(false)));
    handleLegacyAuthToggled(e);

    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "legacyAuthEnabled",
      "false",
    );
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "legacyAuthToggledBy",
      OPERATOR.toHexString(),
    );
    assert.entityCount("RoleActivity", 1);
  });

  test("legacy auth usage is logged, aggregated per selector and counted globally", () => {
    for (let i = 0; i < 3; i++) {
      const e = baseEvent<LegacyAuthUsed>();
      e.logIndex = BigInt.fromI32(i);
      e.parameters.push(param("caller", ethereum.Value.fromAddress(ALICE)));
      e.parameters.push(
        param("selector", ethereum.Value.fromFixedBytes(GRANT_ROLE_SELECTOR)),
      );
      handleLegacyAuthUsed(e);
    }

    assert.entityCount("LegacyAuthUsage", 3);
    const statsId = DIAMOND.concat(GRANT_ROLE_SELECTOR).toHexString();
    assert.fieldEquals("LegacyAuthSelectorStats", statsId, "count", "3");
    assert.fieldEquals(
      "LegacyAuthSelectorStats",
      statsId,
      "source",
      "MAIN_DIAMOND",
    );
    assert.fieldEquals(
      "LegacyAuthSelectorStats",
      statsId,
      "functionName",
      "RoleAdminFacet.grantRole(uint8,address)",
    );
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "legacyAuthUsedCount",
      "3",
    );
    assert.fieldEquals(
      "ProtocolAuthState",
      AUTH_ID,
      "legacyAuthEnabled",
      "true",
    );
    // No policy row is invented for an unconfigured selector.
    assert.entityCount("SelectorPolicy", 0);
  });
});

describe("RoleAdminFacet — dual-sign lifecycle", () => {
  afterEach(() => {
    clearStore();
  });

  test("propose → consume", () => {
    proposeCoSign();
    const id = KEY.toHexString();
    assert.fieldEquals("CoSign", id, "status", "PROPOSED");
    assert.fieldEquals("CoSign", id, "proposerRoleName", "MARKETING_LEAD");
    assert.fieldEquals("CoSign", id, "expiry", "604801");

    const c = baseEvent<CoSignConsumed>();
    c.parameters.push(
      param("selector", ethereum.Value.fromFixedBytes(GRANT_ROLE_SELECTOR)),
    );
    c.parameters.push(param("key", ethereum.Value.fromFixedBytes(KEY)));
    c.parameters.push(param("proposer", ethereum.Value.fromAddress(ALICE)));
    c.parameters.push(param("executor", ethereum.Value.fromAddress(BOB)));
    handleCoSignConsumed(c);

    assert.fieldEquals("CoSign", id, "status", "CONSUMED");
    assert.fieldEquals("CoSign", id, "executor", BOB.toHexString());
    assert.fieldEquals("CoSign", id, "resolvedAt", "1");
  });

  test("propose → cancel → re-propose reuses the row", () => {
    proposeCoSign();
    const c = baseEvent<CoSignCancelled>();
    c.parameters.push(param("key", ethereum.Value.fromFixedBytes(KEY)));
    c.parameters.push(param("by", ethereum.Value.fromAddress(OPERATOR)));
    handleCoSignCancelled(c);

    const id = KEY.toHexString();
    assert.fieldEquals("CoSign", id, "status", "CANCELLED");
    assert.fieldEquals("CoSign", id, "cancelledBy", OPERATOR.toHexString());

    proposeCoSign();
    assert.fieldEquals("CoSign", id, "status", "PROPOSED");
    assert.entityCount("CoSign", 1);
  });
});

describe("RoleAdminFacet — timelock binding", () => {
  afterEach(() => {
    clearStore();
  });

  test("binding creates the LeadTimelock row and the role link", () => {
    const e = baseEvent<RoleTimelockSet>();
    e.parameters.push(param("role", ethereum.Value.fromI32(ROLE_DEV_LEAD)));
    e.parameters.push(
      param("previous", ethereum.Value.fromAddress(Address.zero())),
    );
    e.parameters.push(param("current", ethereum.Value.fromAddress(TIMELOCK)));
    handleRoleTimelockSet(e);

    const tl = TIMELOCK.toHexString();
    assert.fieldEquals("LeadTimelock", tl, "isBound", "true");
    assert.fieldEquals("LeadTimelock", tl, "roleName", "DEV_LEAD");
    assert.fieldEquals(
      "ProtocolRole",
      protocolRoleId(ROLE_DEV_LEAD).toHexString(),
      "timelock",
      tl,
    );

    // Unbind: role keeps no timelock, the old instance is marked unbound.
    const u = baseEvent<RoleTimelockSet>();
    u.parameters.push(param("role", ethereum.Value.fromI32(ROLE_DEV_LEAD)));
    u.parameters.push(param("previous", ethereum.Value.fromAddress(TIMELOCK)));
    u.parameters.push(
      param("current", ethereum.Value.fromAddress(Address.zero())),
    );
    handleRoleTimelockSet(u);
    assert.fieldEquals("LeadTimelock", tl, "isBound", "false");
    assert.fieldEquals("LeadTimelock", tl, "unboundAt", "1");
    assert.entityCount("RoleActivity", 2);
  });
});
