// Role registry constants — mirror `contracts/storages/RoleStorage.sol`
// (roles & permissions rollout, plan §2.1–§2.3). Roles are BIT POSITIONS in a
// uint256 mask: no hierarchy, no inheritance, no wildcard.

export const ROLE_DEV_LEAD: i32 = 0;
export const ROLE_OPS_LEAD: i32 = 1;
export const ROLE_MARKETING_LEAD: i32 = 2;
export const ROLE_FRAUD_MANAGER: i32 = 3;
export const ROLE_ADMIN: i32 = 4;
export const ROLE_CIRCLE_ADMIN: i32 = 5;
export const ROLE_COMMUNITY_ADMIN: i32 = 6;
export const ROLE_PRICE_UPDATER: i32 = 7;
export const ROLE_CAPABILITY_GRANTEE: i32 = 8;
// Bit 9 is RETIRED: its order/fiat powers moved to DEV_LEAD and its
// insurance-claim powers to ADMIN (which keeps the country binding claim
// review needs). The bit is deliberately not reused and the others are not
// renumbered, because renumbering would silently re-point every live on-chain
// grant. MAX_ROLE stays 9 so a member still holding the retired bit remains
// revocable — bit 9 appears in no policy mask, so membership authorizes
// nothing, but it can still be granted and revoked until the registry is
// drained of it. Expect grants on it to keep appearing until then.
export const ROLE_ADMIN_VALUE_RETIRED: i32 = 9;
export const MAX_ROLE: i32 = 9;

const ROLE_NAMES: string[] = [
  "DEV_LEAD",
  "OPS_LEAD",
  "MARKETING_LEAD",
  "FRAUD_MANAGER",
  "ADMIN",
  "CIRCLE_ADMIN",
  "COMMUNITY_ADMIN",
  "PRICE_UPDATER",
  "CAPABILITY_GRANTEE",
  // Labelled retired so a consumer rendering roleNames cannot show bit 9 as
  // live authority: it is still holdable, but grants nothing.
  "ADMIN_VALUE_RETIRED",
];

// SCOPE_* — which binding check applies on top of the role mask.
export const SCOPE_GLOBAL: i32 = 0;
export const SCOPE_COUNTRY: i32 = 1;
export const SCOPE_CIRCLE: i32 = 2;
export const SCOPE_CURRENCY: i32 = 3;

const SCOPE_NAMES: string[] = ["GLOBAL", "COUNTRY", "CIRCLE", "CURRENCY"];

// TIER_* — recommended custody / review level.
export const TIER_ROUTINE: i32 = 0;
export const TIER_SENSITIVE: i32 = 1;
export const TIER_CATASTROPHIC: i32 = 2;

const TIER_NAMES: string[] = ["ROUTINE", "SENSITIVE", "CATASTROPHIC"];

// Emission points of `LegacyAuthUsed` (plan WS-9.2: the R7 flip criterion is
// seven consecutive days with zero emissions across all three).
export const AUTH_SOURCE_MAIN_DIAMOND = "MAIN_DIAMOND";
export const AUTH_SOURCE_INSURANCE_DIAMOND = "INSURANCE_DIAMOND";
export const AUTH_SOURCE_REPUTATION_MANAGER = "REPUTATION_MANAGER";

// Role activity log actions.
export const ROLE_ACTION_GRANTED = "ROLE_GRANTED";
export const ROLE_ACTION_REVOKED = "ROLE_REVOKED";
export const ROLE_ACTION_COUNTRY_ASSIGNED = "COUNTRY_ASSIGNED";
export const ROLE_ACTION_COUNTRY_UNASSIGNED = "COUNTRY_UNASSIGNED";
export const ROLE_ACTION_TIMELOCK_SET = "TIMELOCK_SET";
export const ROLE_ACTION_POLICY_SET = "POLICY_SET";
export const ROLE_ACTION_POLICY_CLEARED = "POLICY_CLEARED";
export const ROLE_ACTION_LEGACY_AUTH_TOGGLED = "LEGACY_AUTH_TOGGLED";
export const ROLE_ACTION_LEGACY_EXEMPT_SET = "LEGACY_EXEMPT_SET";

// Co-sign lifecycle.
export const COSIGN_STATUS_PROPOSED = "PROPOSED";
export const COSIGN_STATUS_CANCELLED = "CANCELLED";
export const COSIGN_STATUS_CONSUMED = "CONSUMED";

// Timelock operation lifecycle (OpenZeppelin TimelockController semantics).
export const TIMELOCK_OP_PENDING = "PENDING";
export const TIMELOCK_OP_EXECUTED = "EXECUTED";
export const TIMELOCK_OP_CANCELLED = "CANCELLED";

// Insurance claim contest activity.
export const CONTEST_ACTION_CONTESTED = "CONTESTED";
export const CONTEST_ACTION_REMOVED = "CONTEST_REMOVED";

export function roleName(role: i32): string {
  if (role >= 0 && role < ROLE_NAMES.length) return ROLE_NAMES[role];
  return "UNKNOWN_ROLE_" + role.toString();
}

export function scopeName(scope: i32): string {
  if (scope >= 0 && scope < SCOPE_NAMES.length) return SCOPE_NAMES[scope];
  return "UNKNOWN_SCOPE_" + scope.toString();
}

export function tierName(tier: i32): string {
  if (tier >= 0 && tier < TIER_NAMES.length) return TIER_NAMES[tier];
  return "UNKNOWN_TIER_" + tier.toString();
}
