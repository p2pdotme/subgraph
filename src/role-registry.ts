import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CoSignCancelled as CoSignCancelledEvent,
  CoSignProposed as CoSignProposedEvent,
  CountryAssigned as CountryAssignedEvent,
  LegacyAuthToggled as LegacyAuthToggledEvent,
  LegacyAuthUsed as LegacyAuthUsedEvent,
  LegacyExemptSet as LegacyExemptSetEvent,
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
  RoleTimelockSet as RoleTimelockSetEvent,
  SelectorPolicyCleared as SelectorPolicyClearedEvent,
  SelectorPolicySet as SelectorPolicySetEvent,
} from "../generated/RoleAdminFacet/RoleAdminFacet";
import { LeadTimelock as LeadTimelockTemplate } from "../generated/templates";
import { LeadTimelock } from "../generated/schema";
import {
  applyCoSignRoleMask,
  applyRoleMask,
  functionNameOf,
  loadAdminCountry,
  loadCoSign,
  loadCountry,
  loadLeadTimelock,
  loadProtocolAuthState,
  loadProtocolRole,
  loadRoleMember,
  loadSelectorPolicy,
  newRoleActivity,
  recordLegacyAuthUsed,
} from "./lib";
import {
  AUTH_SOURCE_MAIN_DIAMOND,
  COSIGN_STATUS_CANCELLED,
  COSIGN_STATUS_PROPOSED,
  ROLE_ACTION_COUNTRY_ASSIGNED,
  ROLE_ACTION_COUNTRY_UNASSIGNED,
  ROLE_ACTION_GRANTED,
  ROLE_ACTION_LEGACY_AUTH_TOGGLED,
  ROLE_ACTION_LEGACY_EXEMPT_SET,
  ROLE_ACTION_POLICY_CLEARED,
  ROLE_ACTION_POLICY_SET,
  ROLE_ACTION_REVOKED,
  ROLE_ACTION_TIMELOCK_SET,
  roleName,
  scopeName,
  tierName,
} from "./constants/roles";
import { bytes32ToAscii } from "./utils";

// ─────────────────────────── membership ──────────────────────────────────

export function handleRoleGranted(event: RoleGrantedEvent): void {
  const role = event.params.role;
  const member = loadRoleMember(role, event.params.account, event);
  const wasActive = member.isActive;

  member.isActive = true;
  member.operator = event.params.operator;
  member.grantedAt = event.block.timestamp;
  member.revokedAt = null;
  member.save();

  const protocolRole = loadProtocolRole(role, event);
  if (!wasActive) protocolRole.memberCount += 1;
  protocolRole.save();

  const activity = newRoleActivity(
    event,
    ROLE_ACTION_GRANTED,
    event.params.operator,
  );
  activity.role = role;
  activity.roleName = roleName(role);
  activity.account = event.params.account;
  activity.save();
}

export function handleRoleRevoked(event: RoleRevokedEvent): void {
  const role = event.params.role;
  const member = loadRoleMember(role, event.params.account, event);
  const wasActive = member.isActive;

  member.isActive = false;
  member.operator = event.params.operator;
  member.revokedAt = event.block.timestamp;
  member.save();

  const protocolRole = loadProtocolRole(role, event);
  if (wasActive && protocolRole.memberCount > 0) protocolRole.memberCount -= 1;
  protocolRole.save();

  const activity = newRoleActivity(
    event,
    ROLE_ACTION_REVOKED,
    event.params.operator,
  );
  activity.role = role;
  activity.roleName = roleName(role);
  activity.account = event.params.account;
  activity.save();
}

export function handleCountryAssigned(event: CountryAssignedEvent): void {
  const country = event.params.country;

  // Make sure the Country row exists even if the R5 seed assigned it before
  // `setCountryActive` was indexed for it.
  loadCountry(country, event).save();

  const assignment = loadAdminCountry(event.params.admin, country, event);
  assignment.assigned = event.params.assigned;
  assignment.operator = event.params.operator;
  if (event.params.assigned) {
    assignment.assignedAt = event.block.timestamp;
    assignment.unassignedAt = null;
  } else {
    assignment.unassignedAt = event.block.timestamp;
  }
  assignment.save();

  const activity = newRoleActivity(
    event,
    event.params.assigned
      ? ROLE_ACTION_COUNTRY_ASSIGNED
      : ROLE_ACTION_COUNTRY_UNASSIGNED,
    event.params.operator,
  );
  activity.account = event.params.admin;
  activity.country = country;
  activity.countryCode = bytes32ToAscii(country);
  activity.flag = event.params.assigned;
  activity.save();
}

// ─────────────────────────── timelock binding ────────────────────────────

export function handleRoleTimelockSet(event: RoleTimelockSetEvent): void {
  const role = event.params.role;
  const previous = event.params.previous;
  const current = event.params.current;

  const protocolRole = loadProtocolRole(role, event);

  if (previous.notEqual(Address.zero())) {
    const old = loadLeadTimelock(previous, event);
    old.isBound = false;
    old.unboundAt = event.block.timestamp;
    old.save();
  }

  if (current.notEqual(Address.zero())) {
    // First sighting of this timelock: start indexing its operations.
    if (LeadTimelock.load(current) == null) {
      LeadTimelockTemplate.create(current);
    }
    const timelock = loadLeadTimelock(current, event);
    timelock.role = role;
    timelock.roleName = roleName(role);
    timelock.isBound = true;
    timelock.boundAt = event.block.timestamp;
    timelock.unboundAt = null;
    timelock.save();
    protocolRole.timelock = current;
  } else {
    protocolRole.timelock = null;
  }
  protocolRole.save();

  const activity = newRoleActivity(
    event,
    ROLE_ACTION_TIMELOCK_SET,
    event.transaction.from,
  );
  activity.role = role;
  activity.roleName = roleName(role);
  activity.timelock = current;
  activity.previousTimelock = previous;
  activity.save();
}

// ─────────────────────────── selector policies ───────────────────────────

export function handleSelectorPolicySet(event: SelectorPolicySetEvent): void {
  const selector = event.params.selector;
  const p = event.params.policy;

  const policy = loadSelectorPolicy(selector, event);
  const wasConfigured = policy.configured;

  applyRoleMask(policy, p.roleMask);
  policy.permissionless = p.permissionless;
  policy.scope = p.scope;
  policy.scopeName = scopeName(p.scope);
  policy.tier = p.tier;
  policy.tierName = tierName(p.tier);
  policy.timelocked = p.timelocked;
  policy.dualSign = p.dualSign;
  applyCoSignRoleMask(policy, p.coSignRoleMask);
  policy.configured = p.configured;
  policy.updateCount += 1;
  policy.save();

  if (policy.configured != wasConfigured) {
    const state = loadProtocolAuthState(event);
    state.configuredSelectorCount += policy.configured ? 1 : -1;
    state.save();
  }

  const activity = newRoleActivity(
    event,
    ROLE_ACTION_POLICY_SET,
    event.transaction.from,
  );
  activity.selector = selector;
  activity.functionName = policy.functionName;
  activity.save();
}

export function handleSelectorPolicyCleared(
  event: SelectorPolicyClearedEvent,
): void {
  const selector = event.params.selector;
  const policy = loadSelectorPolicy(selector, event);
  const wasConfigured = policy.configured;

  // On-chain `delete` zeroes the struct; legacyExempt is a separate mapping
  // and the usage counters are history, so both survive.
  applyRoleMask(policy, BigInt.zero());
  policy.permissionless = false;
  policy.scope = 0;
  policy.scopeName = scopeName(0);
  policy.tier = 0;
  policy.tierName = tierName(0);
  policy.timelocked = false;
  policy.dualSign = false;
  applyCoSignRoleMask(policy, BigInt.zero());
  policy.configured = false;
  policy.updateCount += 1;
  policy.save();

  if (wasConfigured) {
    const state = loadProtocolAuthState(event);
    if (state.configuredSelectorCount > 0) state.configuredSelectorCount -= 1;
    state.save();
  }

  const activity = newRoleActivity(
    event,
    ROLE_ACTION_POLICY_CLEARED,
    event.transaction.from,
  );
  activity.selector = selector;
  activity.functionName = policy.functionName;
  activity.save();
}

export function handleLegacyExemptSet(event: LegacyExemptSetEvent): void {
  const selector = event.params.selector;
  const policy = loadSelectorPolicy(selector, event);
  policy.legacyExempt = event.params.exempt;
  policy.save();

  const activity = newRoleActivity(
    event,
    ROLE_ACTION_LEGACY_EXEMPT_SET,
    event.transaction.from,
  );
  activity.selector = selector;
  activity.functionName = policy.functionName;
  activity.flag = event.params.exempt;
  activity.save();
}

// ─────────────────────────── shadow mode ─────────────────────────────────

export function handleLegacyAuthToggled(event: LegacyAuthToggledEvent): void {
  const state = loadProtocolAuthState(event);
  state.legacyAuthEnabled = event.params.enabled;
  state.legacyAuthToggledBy = event.params.operator;
  state.legacyAuthToggledAt = event.block.timestamp;
  state.save();

  const activity = newRoleActivity(
    event,
    ROLE_ACTION_LEGACY_AUTH_TOGGLED,
    event.params.operator,
  );
  activity.flag = event.params.enabled;
  activity.save();
}

export function handleLegacyAuthUsed(event: LegacyAuthUsedEvent): void {
  recordLegacyAuthUsed(
    event,
    AUTH_SOURCE_MAIN_DIAMOND,
    event.params.caller,
    event.params.selector,
  );
}

// ─────────────────────────── dual-sign ───────────────────────────────────

export function handleCoSignProposed(event: CoSignProposedEvent): void {
  const coSign = loadCoSign(event.params.key, event);
  // A proposer may refresh their own record: the row is reused and reset.
  coSign.selector = event.params.selector;
  coSign.functionName = functionNameOf(event.params.selector);
  coSign.proposer = event.params.proposer;
  coSign.proposerRole = event.params.role;
  coSign.proposerRoleName = roleName(event.params.role);
  coSign.expiry = event.params.expiry;
  coSign.status = COSIGN_STATUS_PROPOSED;
  coSign.cancelledBy = null;
  coSign.executor = null;
  coSign.proposedAt = event.block.timestamp;
  coSign.resolvedAt = null;
  coSign.save();
}

export function handleCoSignCancelled(event: CoSignCancelledEvent): void {
  const coSign = loadCoSign(event.params.key, event);
  coSign.status = COSIGN_STATUS_CANCELLED;
  coSign.cancelledBy = event.params.by;
  coSign.resolvedAt = event.block.timestamp;
  coSign.save();
}
