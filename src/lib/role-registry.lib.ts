import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AdminCountry,
  CoSign,
  Country,
  EmergencyPauseActivity,
  InsuranceClaimContestActivity,
  LeadTimelock,
  LegacyAdmin,
  LegacyAuthSelectorStats,
  LegacyAuthUsage,
  ProtocolAuthState,
  ProtocolRole,
  RoleActivity,
  RoleMember,
  SelectorPolicy,
  TimelockCall,
  TimelockOperation,
} from "../../generated/schema";
import {
  AUTH_SOURCE_MAIN_DIAMOND,
  COSIGN_STATUS_PROPOSED,
  TIMELOCK_OP_PENDING,
  roleName,
  scopeName,
  tierName,
} from "../constants/roles";
import { selectorFunctionName } from "../constants/selectors";
import { bytes32ToAscii, bytesFromU8, logKey, maskToBits } from "../utils";

// ─────────────────────────── singleton ───────────────────────────────────

export function protocolAuthStateId(): Bytes {
  return Bytes.fromUTF8("auth");
}

export function loadProtocolAuthState(
  event: ethereum.Event,
): ProtocolAuthState {
  const id = protocolAuthStateId();
  let state = ProtocolAuthState.load(id);
  if (!state) {
    state = new ProtocolAuthState(id);
    // Stored inverted on-chain (`legacyAuthDisabled`): the default is ON.
    state.legacyAuthEnabled = true;
    state.legacyAuthToggledBy = null;
    state.legacyAuthToggledAt = null;
    state.legacyAuthUsedCount = BigInt.zero();
    state.lastLegacyAuthUsedAt = null;
    state.configuredSelectorCount = 0;
    state.emergencyPaused = false;
    state.emergencyPausedBy = null;
    state.emergencyPausedAt = null;
  }

  state.blockNumber = event.block.number;
  state.blockTimestamp = event.block.timestamp;
  state.transactionHash = event.transaction.hash;

  return state;
}

// ─────────────────────────── roles ───────────────────────────────────────

export function protocolRoleId(role: i32): Bytes {
  return bytesFromU8(role);
}

export function loadProtocolRole(
  role: i32,
  event: ethereum.Event,
): ProtocolRole {
  const id = protocolRoleId(role);
  let entity = ProtocolRole.load(id);
  if (!entity) {
    entity = new ProtocolRole(id);
    entity.role = role;
    entity.name = roleName(role);
    entity.memberCount = 0;
    entity.timelock = null;
  }

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  return entity;
}

export function roleMemberId(role: i32, account: Bytes): Bytes {
  return bytesFromU8(role).concat(account);
}

export function loadRoleMember(
  role: i32,
  account: Bytes,
  event: ethereum.Event,
): RoleMember {
  const id = roleMemberId(role, account);
  let member = RoleMember.load(id);
  if (!member) {
    member = new RoleMember(id);
    member.protocolRole = protocolRoleId(role);
    member.role = role;
    member.roleName = roleName(role);
    member.account = account;
    member.isActive = false;
    member.operator = Bytes.empty();
    member.grantedAt = BigInt.zero();
    member.revokedAt = null;
  }

  member.blockNumber = event.block.number;
  member.blockTimestamp = event.block.timestamp;
  member.transactionHash = event.transaction.hash;

  return member;
}

// ─────────────────────────── countries ───────────────────────────────────

export function loadCountry(country: Bytes, event: ethereum.Event): Country {
  let entity = Country.load(country);
  if (!entity) {
    entity = new Country(country);
    entity.country = country;
    entity.code = bytes32ToAscii(country);
    entity.isActive = false;
  }

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  return entity;
}

export function adminCountryId(admin: Bytes, country: Bytes): Bytes {
  return admin.concat(country);
}

export function loadAdminCountry(
  admin: Bytes,
  country: Bytes,
  event: ethereum.Event,
): AdminCountry {
  const id = adminCountryId(admin, country);
  let entity = AdminCountry.load(id);
  if (!entity) {
    entity = new AdminCountry(id);
    entity.admin = admin;
    entity.country = country;
    entity.countryCode = bytes32ToAscii(country);
    entity.assigned = false;
    entity.operator = Bytes.empty();
    entity.assignedAt = BigInt.zero();
    entity.unassignedAt = null;
  }

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  return entity;
}

// ─────────────────────────── selector policies ───────────────────────────

export function functionNameOf(selector: Bytes): string {
  return selectorFunctionName(selector.toHexString());
}

export function loadSelectorPolicy(
  selector: Bytes,
  event: ethereum.Event,
): SelectorPolicy {
  let policy = SelectorPolicy.load(selector);
  if (!policy) {
    policy = new SelectorPolicy(selector);
    policy.selector = selector;
    policy.functionName = functionNameOf(selector);
    policy.roleMask = BigInt.zero();
    policy.roles = [];
    policy.roleNames = [];
    policy.permissionless = false;
    policy.scope = 0;
    policy.scopeName = scopeName(0);
    policy.tier = 0;
    policy.tierName = tierName(0);
    policy.timelocked = false;
    policy.dualSign = false;
    policy.coSignRoleMask = BigInt.zero();
    policy.coSignRoles = [];
    policy.coSignRoleNames = [];
    policy.configured = false;
    policy.legacyExempt = false;
    policy.legacyAuthUsedCount = BigInt.zero();
    policy.lastLegacyAuthUsedAt = null;
    policy.updateCount = 0;
  }

  policy.blockNumber = event.block.number;
  policy.blockTimestamp = event.block.timestamp;
  policy.transactionHash = event.transaction.hash;

  return policy;
}

/** Writes roleMask-derived fields (`roles`, `roleNames`) from a bitmask. */
export function applyRoleMask(policy: SelectorPolicy, mask: BigInt): void {
  const bits = maskToBits(mask);
  const names: string[] = [];
  for (let i = 0; i < bits.length; i++) names.push(roleName(bits[i]));
  policy.roleMask = mask;
  policy.roles = bits;
  policy.roleNames = names;
}

export function applyCoSignRoleMask(
  policy: SelectorPolicy,
  mask: BigInt,
): void {
  const bits = maskToBits(mask);
  const names: string[] = [];
  for (let i = 0; i < bits.length; i++) names.push(roleName(bits[i]));
  policy.coSignRoleMask = mask;
  policy.coSignRoles = bits;
  policy.coSignRoleNames = names;
}

// ─────────────────────────── activity log ────────────────────────────────

export function newRoleActivity(
  event: ethereum.Event,
  action: string,
  operator: Bytes,
): RoleActivity {
  const activity = new RoleActivity(
    logKey(event.transaction.hash, event.logIndex),
  );
  activity.action = action;
  activity.operator = operator;
  activity.roleName = null;
  activity.account = null;
  activity.country = null;
  activity.countryCode = null;
  activity.selector = null;
  activity.functionName = null;
  activity.timelock = null;
  activity.previousTimelock = null;
  activity.blockNumber = event.block.number;
  activity.blockTimestamp = event.block.timestamp;
  activity.transactionHash = event.transaction.hash;
  return activity;
}

// ─────────────────────────── co-sign ─────────────────────────────────────

export function loadCoSign(key: Bytes, event: ethereum.Event): CoSign {
  let coSign = CoSign.load(key);
  if (!coSign) {
    coSign = new CoSign(key);
    coSign.key = key;
    coSign.selector = Bytes.empty();
    coSign.functionName = "";
    coSign.proposer = Bytes.empty();
    coSign.proposerRole = 0;
    coSign.proposerRoleName = "";
    coSign.expiry = BigInt.zero();
    coSign.status = COSIGN_STATUS_PROPOSED;
    coSign.cancelledBy = null;
    coSign.executor = null;
    coSign.proposedAt = event.block.timestamp;
    coSign.resolvedAt = null;
  }

  coSign.blockNumber = event.block.number;
  coSign.blockTimestamp = event.block.timestamp;
  coSign.transactionHash = event.transaction.hash;

  return coSign;
}

// ─────────────────────────── legacy auth ─────────────────────────────────

/**
 * Records one `LegacyAuthUsed` emission: the immutable row, the per-selector
 * aggregate for its emitter, the protocol-wide counter, and — for the main
 * Diamond — the counter on the selector's policy row.
 */
export function recordLegacyAuthUsed(
  event: ethereum.Event,
  source: string,
  caller: Bytes,
  selector: Bytes,
): void {
  const emitter = changetype<Bytes>(event.address);
  const functionName = functionNameOf(selector);

  const usage = new LegacyAuthUsage(
    logKey(event.transaction.hash, event.logIndex),
  );
  usage.source = source;
  usage.emitter = emitter;
  usage.caller = caller;
  usage.selector = selector;
  usage.functionName = functionName;
  usage.blockNumber = event.block.number;
  usage.blockTimestamp = event.block.timestamp;
  usage.transactionHash = event.transaction.hash;
  usage.save();

  const statsId = emitter.concat(selector);
  let stats = LegacyAuthSelectorStats.load(statsId);
  if (!stats) {
    stats = new LegacyAuthSelectorStats(statsId);
    stats.source = source;
    stats.emitter = emitter;
    stats.selector = selector;
    stats.functionName = functionName;
    stats.count = BigInt.zero();
    stats.firstUsedAt = event.block.timestamp;
  }
  stats.count = stats.count.plus(BigInt.fromI32(1));
  stats.lastUsedAt = event.block.timestamp;
  stats.lastCaller = caller;
  stats.blockNumber = event.block.number;
  stats.blockTimestamp = event.block.timestamp;
  stats.transactionHash = event.transaction.hash;
  stats.save();

  const state = loadProtocolAuthState(event);
  state.legacyAuthUsedCount = state.legacyAuthUsedCount.plus(BigInt.fromI32(1));
  state.lastLegacyAuthUsedAt = event.block.timestamp;
  state.save();

  if (source == AUTH_SOURCE_MAIN_DIAMOND) {
    const policy = SelectorPolicy.load(selector);
    if (policy) {
      policy.legacyAuthUsedCount = policy.legacyAuthUsedCount.plus(
        BigInt.fromI32(1),
      );
      policy.lastLegacyAuthUsedAt = event.block.timestamp;
      policy.save();
    }
  }
}

export function loadLegacyAdmin(
  account: Bytes,
  event: ethereum.Event,
): LegacyAdmin {
  let admin = LegacyAdmin.load(account);
  if (!admin) {
    admin = new LegacyAdmin(account);
    admin.account = account;
    admin.isSuperAdmin = false;
    admin.isAdmin = false;
    admin.isGlobalAdmin = false;
    admin.updater = Bytes.empty();
  }

  admin.blockNumber = event.block.number;
  admin.blockTimestamp = event.block.timestamp;
  admin.transactionHash = event.transaction.hash;

  return admin;
}

// ─────────────────────────── pause / contest logs ────────────────────────

export function newEmergencyPauseActivity(
  event: ethereum.Event,
  by: Bytes,
  paused: boolean,
): EmergencyPauseActivity {
  const activity = new EmergencyPauseActivity(
    logKey(event.transaction.hash, event.logIndex),
  );
  activity.by = by;
  activity.paused = paused;
  activity.blockNumber = event.block.number;
  activity.blockTimestamp = event.block.timestamp;
  activity.transactionHash = event.transaction.hash;
  return activity;
}

export function newInsuranceClaimContestActivity(
  event: ethereum.Event,
  claimId: BigInt,
  action: string,
  by: Bytes,
): InsuranceClaimContestActivity {
  const activity = new InsuranceClaimContestActivity(
    logKey(event.transaction.hash, event.logIndex),
  );
  activity.claimId = claimId;
  activity.claim = Bytes.fromByteArray(Bytes.fromBigInt(claimId));
  activity.action = action;
  activity.by = by;
  activity.newEligibleAt = null;
  activity.blockNumber = event.block.number;
  activity.blockTimestamp = event.block.timestamp;
  activity.transactionHash = event.transaction.hash;
  return activity;
}

// ─────────────────────────── timelocks ───────────────────────────────────

export function loadLeadTimelock(
  address: Bytes,
  event: ethereum.Event,
): LeadTimelock {
  let timelock = LeadTimelock.load(address);
  if (!timelock) {
    timelock = new LeadTimelock(address);
    timelock.address = address;
    timelock.role = 0;
    timelock.roleName = "";
    timelock.isBound = false;
    timelock.boundAt = BigInt.zero();
    timelock.unboundAt = null;
    timelock.minDelay = null;
    timelock.operationCount = 0;
    timelock.pendingCount = 0;
  }

  timelock.blockNumber = event.block.number;
  timelock.blockTimestamp = event.block.timestamp;
  timelock.transactionHash = event.transaction.hash;

  return timelock;
}

export function timelockOperationId(
  timelock: Bytes,
  operationId: Bytes,
): Bytes {
  return timelock.concat(operationId);
}

export function loadTimelockOperation(
  timelock: Bytes,
  operationId: Bytes,
  event: ethereum.Event,
): TimelockOperation {
  const id = timelockOperationId(timelock, operationId);
  let operation = TimelockOperation.load(id);
  if (!operation) {
    operation = new TimelockOperation(id);
    operation.timelock = timelock;
    operation.operationId = operationId;
    operation.predecessor = Bytes.empty();
    operation.salt = null;
    operation.delay = BigInt.zero();
    operation.status = TIMELOCK_OP_PENDING;
    operation.scheduledAt = event.block.timestamp;
    operation.readyAt = event.block.timestamp;
    operation.executedAt = null;
    operation.cancelledAt = null;
    operation.callCount = 0;
    operation.executedCallCount = 0;
  }

  operation.blockNumber = event.block.number;
  operation.blockTimestamp = event.block.timestamp;
  operation.transactionHash = event.transaction.hash;

  return operation;
}

export function loadTimelockCall(
  timelock: Bytes,
  operationId: Bytes,
  index: i32,
  event: ethereum.Event,
): TimelockCall {
  const id = timelockOperationId(timelock, operationId).concatI32(index);
  let call = TimelockCall.load(id);
  if (!call) {
    call = new TimelockCall(id);
    call.operation = timelockOperationId(timelock, operationId);
    call.index = index;
    call.target = Bytes.empty();
    call.value = BigInt.zero();
    call.data = Bytes.empty();
    call.selector = Bytes.empty();
    call.functionName = "";
    call.executed = false;
    call.executedAt = null;
  }

  call.blockNumber = event.block.number;
  call.blockTimestamp = event.block.timestamp;
  call.transactionHash = event.transaction.hash;

  return call;
}
