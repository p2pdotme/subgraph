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
// RETIRED at R8.2: it appears in no policy mask and never did. Circle
// moderators act through CapabilityFacet's own per-selector grants
// (`grantPermission`), which need no registry role, so the bit was never
// wired to one. LibAuth keeps its circle-binding code — bit 8 is still in
// CIRCLE_SCOPED_MASK — inert while no mask names the bit. Ops stays its
// appointer purely so a remaining holder can be revoked.
export const ROLE_CAPABILITY_GRANTEE: i32 = 8;
// Bit 9 is RETIRED: its order/fiat powers moved to DEV_LEAD and its
// insurance-claim powers to ADMIN, and from there to INSURANCE_ADMIN below.
// The bit is deliberately not reused and the others are not renumbered,
// because renumbering would silently re-point every live on-chain grant. It
// stays within MAX_ROLE so a member still holding it remains revocable — bit 9
// appears in no policy mask, so membership authorizes nothing, but it can
// still be granted and revoked until the registry is drained of it. Expect
// grants on it to keep appearing until then. Contracts publish the retirement
// rather than leaving it to a mirror like this one: `RoleStorage
// .RETIRED_ROLE_MASK`, surfaced by `RoleAdminFacet.getRoleCatalog()`, is the
// authority for which bits at or below MAX_ROLE name no live role.
export const ROLE_ADMIN_VALUE_RETIRED: i32 = 9;
// RETIRED at R8.2, after one release as a live seat. It was claim review split
// out of ADMIN as its own country-bound seat (taking approveClaim,
// approveClaimWithAmount, rejectClaim and cancelApprovedClaim off it); the R8.2
// review read spec §3.6 as seating claim approval on the country Admin, so
// those four rows moved BACK to ADMIN and bit 10 names nothing. It still binds
// through the same `adminCountries` set as ADMIN and is still in
// COUNTRY_SCOPED_MASK, so a leftover holder's AdminCountry rows look live;
// they authorize nothing. Bit 10 rather than the vacant 9 when it was created,
// because reusing 9 would have handed claim authority to anyone still holding
// the retired bit — the same reason it is not reused now.
export const ROLE_INSURANCE_ADMIN: i32 = 10;
export const MAX_ROLE: i32 = 10;

/**
 * Bits at or below MAX_ROLE that name NO live role: they appear in no policy
 * mask, `grantRole` refuses them (`RoleRetired`), and `revokeRole` still
 * clears them so leftover holders can be drained. Mirrors
 * `RoleStorage.RETIRED_ROLES_MASK` and contracts' own `RETIRED_ROLE_BITS` in
 * `config/rolePolicy.ts`, which are the two places that agree.
 *
 * NOT `RoleAdminFacet.getRoleCatalog().retiredMask`: that view still returns
 * the older `RETIRED_ROLE_MASK` (bit 9 alone) while `grantRole` gates on
 * `RETIRED_ROLES_MASK` (8 | 9 | 10), so the on-chain catalogue UNDER-REPORTS
 * the retired set by two bits as of r8 33d3175. Reading it would render
 * CAPABILITY_GRANTEE and INSURANCE_ADMIN as live seats that no grant can fill.
 */
const RETIRED_ROLE_BITS: i32[] = [
  ROLE_CAPABILITY_GRANTEE,
  ROLE_ADMIN_VALUE_RETIRED,
  ROLE_INSURANCE_ADMIN,
];

/** True when the bit names no live role — render it as retired, never as
 *  authority, however many `RoleMember` rows still carry it. */
export function isRetiredRole(role: i32): boolean {
  for (let i = 0; i < RETIRED_ROLE_BITS.length; i++) {
    if (RETIRED_ROLE_BITS[i] == role) return true;
  }
  return false;
}

/** `Grant.asSeat` when a grant came from no lead seat: the migration operator
 *  before the flip, or the futarchy bridge (`RoleStorage.NO_SEAT`). */
export const NO_SEAT: i32 = 255;

/** The lead seat a grant was made from. NO_SEAT is not an unknown role — it is
 *  the recorded absence of a seat, and the two must not render alike. */
export function seatName(seat: i32): string {
  if (seat == NO_SEAT) return "NO_SEAT";
  return roleName(seat);
}

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
  "INSURANCE_ADMIN",
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
export const ROLE_ACTION_FUTARCHY_BRIDGE_SET = "FUTARCHY_BRIDGE_SET";
export const ROLE_ACTION_GRANT_RECORDED = "GRANT_RECORDED";
export const ROLE_ACTION_LEAD_MULTISIG_SET = "LEAD_MULTISIG_REQUIREMENT_SET";

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
