# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- R8.2 **seized stake** (InsurancePoolFacet): `SeizedStakeRecorded` /
  `SeizedStakeReleased` onto a `SeizedStake` ledger per (token, country) mirroring
  the Diamond's own `getSeizedStake` / `getSeizedStakeTotal`, plus a
  `SeizedStakeActivity` log that also carries `SeizedMerchantStakeToCaip` (keyed
  by circle, so it does not move the token ledger) and a `PIPContribution` row per
  `contributeToPIP` — open to anyone, so `from` carries no authority. The running
  `amount` is derived from the indexed range and goes **negative** rather than
  clamping when a release has no matching record, because a subgraph deployed
  after a seizure would otherwise show a plausible wrong balance;
  `getSeizedStake` is the authority and the entity says so
- `P2PStakeSeizedForCountry` as `UserP2PStake.seizedForCountry` /
  `seizedForCountryCode`, deliberately **not** a second seizure record. It is
  emitted on the line after `P2PStakeSeized`, in the same transaction, for the
  same act — force-recovery pays the country insurance pool now rather than the
  caller — so an amount-bearing row would have made every user stake seizure read
  as twice what was taken. There is a test pinning `totalSeized` across both
- R8.2 **tiered disputes** (OrderProcessorFacet): `DisputeDecided` and
  `DisputeAppealed` onto `Orders.disputeTier` / `disputeDecisionTier` /
  `disputeDecidedBy` / `disputeDecidedAt` / `disputeAppealableUntil` /
  `disputeAppealCount` / `disputeLastAppealedBy` / `disputeLastAppealedAt`, plus a
  `DisputeActivity` log. A decision is **recorded, not executed** — it takes
  effect at `appealableUntil` unless appealed — so `disputeDecidedAt` and
  `disputeSettledAt` must not be read as the same thing, and an appeal clears the
  pending window rather than leaving a countdown for a superseded decision. The
  two are not a strict alternation either: an UNDECIDED dispute whose tier missed
  its decision SLA can be appealed, so an appeal is not evidence anyone decided.
  `DisputeAppealed` is **not** `OrderAppealed` — that one is a merchant appealing
  an order, once only, and the schema now says so where the fields sit next to
  each other
- `CircleDisputeRejectionSuppressed` as its own immutable
  `CircleDisputeRejectionSuppression` row: the suppression is the fact, and the
  `disputeCounter` it names is the counter's value at that moment, so two
  suppressions of one circle are two rows rather than an overwrite
- R8.2 **per-currency overrides** on `Currency`: `cashbackBps`, `minSellTxLimit`,
  the four `processingTime*` bounds, `disputeAppealWindowSeconds` and
  `disputeDecisionSlaTier1` / `Tier2`. Each overrides a network default and none
  has an un-set — following the default again means setting the default's value —
  so 0 reads as "follow the default" throughout, except `cashbackBps` where 0 is
  also a real setting ("no cashback in this market") and the value alone cannot
  tell the two apart. The dispute SLAs are not cosmetic: missing a tier's SLA is
  itself grounds to appeal
- `RoleGrantRecorded` (RoleAdminFacet, R8.2): `RoleMember.grantedBy`,
  `grantedAsSeat` and `grantedAsSeatName`, plus a `GRANT_RECORDED` `RoleActivity`
  carrying the seat. The seat, not the address, is what may stand a grant down:
  post-flip `grantRole` runs through the lead's TimelockController while the
  undelayed `revokeRole` comes from the lead's Safe, so deriving the appointer
  from `RoleGranted`'s operator would make every grant look revocable by a
  controller that never revokes. `255` (`NO_SEAT`) is the recorded absence of a
  seat — the migration operator before the flip, or the futarchy bridge — and is
  rendered `"NO_SEAT"` rather than `UNKNOWN_ROLE_255`. Null on grants made before
  the event existed, which means "no record", not "no appointer"
- `LeadMultisigRequirementSet` (R8.2): `ProtocolAuthState.requireLeadMultisig` /
  `requireLeadMultisigSetBy` / `requireLeadMultisigSetAt`. While on, a lead seat
  may only be granted to a Safe-shaped multisig (threshold ≥ 2 over ≥ 2 owners)
  and a lead's timelock may only be bound if a current member of that seat
  proposes on it. It defaults off, so `false` is "not required on this Diamond" —
  the testnet shape — and never evidence that a seat is an EOA
- `RoleMember.roleRetired`, recomputed on every touch rather than at create, so a
  bit retired by a later release stops reading as authority on rows written
  before it was. A row can be `isActive: true` and `roleRetired: true` at once:
  `revokeRole` still reaches a retired bit, `grantRole` no longer does
- `FutarchyBridgeUpdated` (RoleAdminFacet): the root appointer's address on
  `ProtocolAuthState.futarchyBridge` / `futarchyBridgeSetBy` /
  `futarchyBridgeSetAt`, plus a `FUTARCHY_BRIDGE_SET` `RoleActivity` carrying
  `bridge` and `previousBridge`. It is the one caller that may grant or revoke
  ANY role, bypassing both the selector policy and the new granter matrix, so it
  is what makes an operator on a `RoleGranted` row readable: matching this
  address means the root path, not the ordinary one. The zero address is stored
  rather than treated as absent, because clearing the bridge removes the path
  and that is a different fact from never having set one
- `src/constants/selectors.ts` regenerated from r8 `b072e9d` / r7 `dde85cd` /
  dev `7dd2e81`: 707 selectors (was 705), adding
  `RoleAdminFacet.setFutarchyBridge(address)` (`0x55ed44f1`) and
  `getFutarchyBridge()` (`0x220ce960`). Without them a policy row or timelocked
  call on the root-appointer setter would render with an empty `functionName`
- `GovernanceDiamondOwnership`: `OwnershipTransferred` on the Governance
  Diamond, which was the one proxy of the three whose owner went unindexed.
  `diamondCut` is owner-gated on all three and each carries its own owner, so
  R7 WS-3.5 is three transfers — indexing two would have shown the upgrade
  authority as settled while the governance proxy stayed cuttable by its
  deployer. Same handler and entities as the other two; rows are keyed by the
  emitting address
- Roles & permissions rollout (contracts-v4 R2 → R8): `RoleAdminFacet` data source
  (`ProtocolRole`, `RoleMember`, `SelectorPolicy`, `RoleActivity`, `CoSign`,
  `ProtocolAuthState`), `LegacyAuthUsed` indexing across the main Diamond,
  Insurance Diamond and ReputationManager (`LegacyAuthUsage`,
  `LegacyAuthSelectorStats`), R5 country scope (`Country`, `AdminCountry`,
  `Currency.country`), R6 claim contests (`InsuranceClaim.contested*`,
  `InsuranceClaimContestActivity`), R7 break-glass pause
  (`EmergencyPauseActivity`), dual-sign consumption, and a `LeadTimelock`
  data-source template (`LeadTimelock`, `TimelockOperation`, `TimelockCall`)
- R1 fund custody (`CircleAdminP2PStakeReturn`, `InsuranceNonPoolTokenSweep`),
  the R4 blacklist rate limit on `ProtocolAuthState`, and Diamond ownership
  (`DiamondOwnership`, `DiamondOwnershipTransfer`) for the R7 move to DevTimelock
- Legacy `superAdmin` / `admin` / `globalAdmin` stores replayed into
  `LegacyAdmin` so the R8 `RetirementInit` address lists can be produced from
  the subgraph
- `LegacyAuthDay`: per-UTC-day buckets of `LegacyAuthUsed` with a per-emitter
  split, so the retirement histogram is one ordered query instead of a
  paginated scan (a quiet day has no row — absence is the zero)
- `ApprovedClaimCancelled`: a currency approver's reversal of an already-APPROVED
  insurance claim. Without it a cancelled claim sat at `APPROVED` in the index
  for good. All three reject paths land on `status = 3`, so the new
  `InsuranceClaim.rejectionKind` is what keeps them apart (1 = reviewer,
  2 = super-admin force reject, 3 = approver cancel)
- `MinFiatAmountUpdated`: the per-currency minimum fiat order amount, on
  `Currency.minFiatAmount`. 0 means no floor, never "block every order"
- `src/constants/selectors.ts` regenerated from r8 `848bc1f` / r7 `64da5b4` /
  dev `7dd2e81`: 710 selectors (was 707), digest `07855e2b5b09`. The three adds
  are the console-facing authorization views R8 publishes —
  `getRoleCatalog()` (`0x01e830dc`),
  `authorizationOf(bytes4,address,bytes32,uint256,bytes32)` (`0x93e888c7`) and
  `authorizationsOf(address,bytes32,uint256,bytes32,uint256,uint256)`
  (`0x363b36a5`) — exactly the `R8_MAIN_ADDS` set the retirement runbook
  enumerates, less `getPermissionMap` which this map already carried. They are
  views and emit nothing, so no handler, schema or ABI change follows; without
  the names a `SelectorPolicy` row or a timelocked call on one would render with
  an empty `functionName`

### Changed

- **R8.2 retires role bits 8 and 10 as well as 9, and moves claim approval back
  to the country `ADMIN`.** Bit 10 (`INSURANCE_ADMIN`) was live for exactly one
  release as claim review split out of `ADMIN`; the R8.2 review read spec §3.6 as
  seating claim approval on the country Admin and moved the four claim rows back,
  leaving the bit naming nothing. Bit 8 (`CAPABILITY_GRANTEE`) was never in a
  policy mask at all — circle moderators act through
  `CapabilityFacet.grantPermission`, which needs no registry role. Both keep
  their names (rows granted while bit 10 was live are still in the store) and
  both keep their scope bindings in `LibAuth`, inert. The previous note here —
  that claim review is seated on `INSURANCE_ADMIN` alone, so an `ADMIN` granted
  by mistake authorizes nothing on a claim — was correct at R8 and is now exactly
  **inverted**: it is the leftover `INSURANCE_ADMIN` whose `AdminCountry` row
  looks correct while authorizing nothing. Corrected, and `RoleMember.roleRetired`
  makes it per-row rather than prose
- **Stopped pointing consumers at `getRoleCatalog()` for the retired set.** That
  view returns `RoleStorage.RETIRED_ROLE_MASK` (bit 9 alone) while `grantRole`
  gates on `RETIRED_ROLES_MASK` (`8 | 9 | 10`), so as of contracts-v4 r8
  `33d3175` the on-chain catalogue under-reports the retired set by two bits and
  would render `CAPABILITY_GRANTEE` and `INSURANCE_ADMIN` as live seats no grant
  can fill. The advice added in the previous entry below was right for R8 and
  wrong for R8.2; the sources that agree are `RETIRED_ROLES_MASK` and contracts'
  own `RETIRED_ROLE_BITS` in `config/rolePolicy.ts`. The view's other five fields
  remain the live authority
- **The selector map is carried forward, not a snapshot of the scanned trees.**
  R6.2's FCM removal reached `main`, so no scanned tree declared `addFcmToken`,
  `removeFcmToken` or `getFcmTokens` and all three names dropped out — while Base
  mainnet, on R6, still serves `SelectorPolicy` rows for them, which would have
  rendered with an empty `functionName`. Unioning several trees only delays this;
  it fails whenever every tracked branch moves past a removal. The generator now
  keeps any selector the committed map already names, lists them under
  `carriedForward` in `selectors.meta.json`, and takes `--no-carry-forward` for a
  throwaway snapshot of what a release removed. `p2pdotme/gov` reaches the same
  conclusion independently (`removed: { at }` in its `gen-inventory.ts`), which
  is what prompted looking
- `EmergencyPauseSet` is **historical-only** from R8.2, which removed
  `emergencyPause` and its toggle, leaving one pause (`setExchangeStatus`, Dev
  only). `ProtocolAuthState.emergencyPaused` / `emergencyPausedBy` /
  `emergencyPausedAt` freeze at their last pre-R8.2 values and must not be read
  as an R8.2 Diamond's live pause state. `CommunityAdminAdded` /
  `CommunityAdminRemoved` are historical-only too — community admins are role bit
  6 and nothing else now, so read them from `RoleMember`
- `src/constants/selectors.ts` regenerated from r8 `33d3175` / r7 `73b25c9` /
  main `af49f8e`: 747 selectors (was 710), digest `3f1a2c42abde`, 3 of them
  carried forward. The 37 new names are R8.2's dispute tiers and appeals, the
  per-currency cashback / processing-time / min-sell settings, the seized-stake
  and reward-pool surfaces, `setRequireLeadMultisig` / `requireLeadMultisig` /
  `getRoleGrant`, and `setExchangeStatus` — the one pause that remains.
  Compiling the R8.2 tree for the generator has to be split into batches now: a
  single `solc` standard-JSON input over the whole tree overflows soljson's wasm
  heap with "memory access out of bounds", which reads like a broken contract and
  is not one
- Documented that the R8 cut's own initializer emits `SelectorPolicySet`,
  `SelectorPolicyCleared` and `LeadMultisigRequirementSet` while running as a
  `delegatecall` from the Diamond, so those logs carry the Diamond's address and
  the existing data source indexes them with no manifest change — policy history
  has no hole across the cut
- Noted that the `p2pdotme/gov` leads console does not query this subgraph at
  all: it reads only the chain and computes authorization at render time. Useful
  context for how a wrong field here fails — quietly, not as a broken screen
- Documented that **`SelectorPolicy.scope` is a claim about the facet's gate that
  the registry does not police**, and what that looks like from here. A row whose
  `scope` disagrees with the `enforce*` / `passes*` variant its facet calls is
  configurable and unrecorded: `enforce*` reverts `PolicyScopeMismatch`, while
  `passes*` returns false and the caller falls through to legacy — so under
  shadow mode the mismatch shows up as a `LegacyAuthUsed` counter that never
  drains, on a `SelectorPolicy` row that still reads as correct. The R7 flip
  criterion is exactly that counter reaching zero, so the failure mode was a
  streak that could not start with nothing here to explain it. R8's new
  `authorizationOf` separates the cases (it evaluates under the policy's own
  scope, so `qualifies: true` against continuing `LegacyAuthUsed` is the mismatch
  signature); the quiet-streak and `scope` notes now say so, and the previous
  wording "the scope is there so the row matches its gate variant" is corrected
  to the obligation it actually is
- Roles prose no longer asks consumers to hard-code what `getRoleCatalog()`
  publishes. `maxRole`, `validMask`, `retiredMask` and the three scoped-role
  masks are now one live call, so the bit-9 retirement and the five bound roles
  are read from the deployment rather than from this README, and a seat added,
  split or retired after it was written surfaces on its own. The prose stays as
  the explanation, and `src/constants/roles.ts` notes `RETIRED_ROLE_MASK` as the
  authority its own bit-9 comment mirrors
- Selector-map provenance moved to the post-R8 trees (r8 `a506bca`, r7
  `64da5b4`, dev `7dd2e81`). R8 retired the eleven one-shot operational helpers
  and deleted `libraries/upgradeEmitEvents.sol`, so the current release no longer
  contains those selectors or the nine events that library emitted —
  regenerating produced a **byte-identical** map (707 selectors, digest
  `eeae7525f964`) because the generator unions the pre-removal r7 and dev trees,
  which is what keeps the eleven `SelectorPolicy` rows resolving to a name. Of
  the nine events, `CircleCreated` and `PaymentChannelMigrationRequest` keep
  real-flow emitters; the other seven are now historical-only and can never fire
  again. R8 also brought in the three events this subgraph already indexes
  (`MinFiatAmountUpdated`, `FutarchyBridgeUpdated`, `ApprovedClaimCancelled`), so
  no handler, schema or ABI change was needed
- `INSURANCE_ADMIN` (role bit 10): contracts split claim review out of the
  general country `ADMIN` into its own country-bound seat, taking the five
  `InsuranceClaimFacet` policy rows with it (`approveClaim`,
  `approveClaimWithAmount`, `rejectClaim`, `cancelApprovedClaim`,
  `settleClaim`). `MAX_ROLE` is 10 and `roles.ts` names the bit, so grants and
  policy masks on it index as `INSURANCE_ADMIN` instead of `UNKNOWN_ROLE_10`;
  `maskToBits` already scanned 32 bits, so no mapping logic changed. Bit 10, not
  the vacant retired 9, because reusing 9 would hand claim authority to anyone
  still holding `ADMIN_VALUE`
- `AdminCountry` now covers `ADMIN` **and** `INSURANCE_ADMIN`: both bind through
  the same on-chain `adminCountries` set, so a row says an address is bound to a
  country without saying for which role — cross it with `RoleMember`. On revoke
  the contract clears the assignments only once the account holds neither role,
  so a revoke of one of the two legitimately leaves the rows `assigned: true`
- Role bit 9 is labelled `ADMIN_VALUE_RETIRED`: contracts retired it, moving its
  order/fiat powers to `DEV_LEAD` and its claim powers to `ADMIN`. The bit is
  not reused and nothing is renumbered, and it stays grantable so holders
  remain revocable — so it can still appear in `RoleMember` / `RoleActivity`
  while authorizing nothing. `ADMIN` is now the only country-scoped role
- Documented that `SelectorPolicy.scope` names the check that runs, not a limit
  on every role in the mask. Only `ADMIN`, `CIRCLE_ADMIN`, `CAPABILITY_GRANTEE`
  and `PRICE_UPDATER` carry a binding; the four leads are unbound, so `LibAuth`
  passes them on a COUNTRY / CIRCLE / CURRENCY row with nothing assigned. A
  permission view that renders "country-scoped" as a per-holder limit understates
  a lead's reach. Also documented that `timelocked` rows consult membership not
  at all — only the bound `LeadTimelock` passes — and that `permissionless`
  overrides both
- Documented that an absent `SelectorPolicy` row is not "nobody can call this".
  Ten admin selectors (`blacklistMerchant`, `adminSettleDispute`,
  `approveOrRejectPaymentChannel`, …) are capability-gated by design and never
  get a policy row; their authority is `CirclePermission.selectors`, and
  `LibCapability.checkPermission` still accepts a super admin, global admin or
  circle admin while legacy auth is on, which is why the `LegacyAuthUsed`
  counters keep ticking on exactly these until explicit grants exist

### Fixed

- The capability-gated set is **twelve** selectors, not ten. contracts-v4 now
  publishes `docs/roles-exclusions.json` — the machine-readable answer to which
  of the four readings a zeroed `getSelectorPolicy` struct means (retired /
  capability-gated / gated elsewhere / unexamined) — and its `capability` bucket
  includes two this repo's README had missed: `InsurancePoolFacet.requestPipRefill`
  and `cancelPipRefill`. Both are Insurance-Diamond entry points that check
  capability cross-diamond against the main Diamond's `checkPermission`, so the
  `PIPRefillRequest` rows written from the Insurance Diamond are authorized by
  main-Diamond `CirclePermission` records. The README now points at that JSON as
  authoritative rather than a hand-kept list. Cross-checked in passing: its
  `roleBits` map (0–8 plus 10, no 9) matches `src/constants/roles.ts` exactly, and
  both new selectors already resolve in the generated selector map
- `CurrencyConfig.monthlyVolumeLimit` was written only by
  `CurrencyMonthlyVolumeLimitUpdate`, a replay-only event emitted by
  `SetterFacet.emitMerchantWithdrawFeePercentageUpdates` — so every live limit
  change went unindexed and the value was only as fresh as the last replay. The
  primary `MonthlyVolumeLimit(currency, limit)` event was in both the
  `SetterFacet` and `CountryFacet` ABIs with no handler; it is now wired on both
  data sources through one shared helper, with the replay handler kept for the
  rows it already wrote. The selector that emits the replay event is on
  contracts-v4's scheduled-removal list, which would have left the field with no
  writer at all
- `scripts/generate-selectors.mjs` dropped every contract named `Legacy*`, a
  rule meant only for the deprecated `Legacy*Facet` shims. It now skips just
  those, so `LegacyAdminClearInit` — the deferred half of the R8 retirement —
  keeps a readable name instead of surfacing as a bare selector
- `src/constants/selectors.meta.json`: contracts-v4 commits and a sha256 digest
  of the generated selector map, so a second inventory generated elsewhere can
  be diffed against it in CI
- `scripts/import-local-stack.mjs`: writes the `localhost` network from a
  contracts-v4 `local:deploy` output so the subgraph can be built and tested
  against the local post-R8 stack
- `scripts/generate-selectors.mjs` + generated `src/constants/selectors.ts`:
  selector → `Contract.fn(types)` labels on policies, co-signs, legacy-auth
  usage and timelock calls
- MIT License and open-source community files (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`)
- `.env.example` for local docker-compose setup

### Changed

- Refreshed ABIs for `CircleFacet`, `CountryFacet`, `InsuranceClaimFacet`,
  `InsurancePoolFacet`, `OrderProcessorFacet`, `SetterFacet`, `CapabilityFacet`,
  `B2BGatewayFacet` from the R8 contracts; added `OwnershipFacet`;
  `ReputationManager` ABI gains the `LegacyAuthUsed` event emitted via the RpHelpers
- Replaced hardcoded postgres password in `docker-compose.yml` with `POSTGRES_PASSWORD` env var

---

## [0.9.0] — 2025

### Added

- `CapabilityFacet`: index `AccountNameUpdated`, `PermissionGranted`, `PermissionRevoked` events (#44)
- ABI and subgraph config updated for security-check sync (#43)
- RBAC (Role-Based Access Control) entity support (#37)
- `MerchantStakeHistory` entity to track stake/unstake lifecycle events (#40)
- Merchant zero-address validation guard (#38)

---

## [0.8.0] — 2025

### Added

- Campaign volume tracking (#35)
- Per-order reward amounts indexed on the `Orders` entity (#33)
- Monthly and daily stats per currency with legacy data support (#29)
- Merchant and admin reward allocation entities (#28)

### Fixed

- Reputation points double-count bug (#31)

---

## [0.7.0] — 2024

### Added

- Legacy order support (pre-COT data sources: `LegacyOrderFlowFacet`, `LegacyOrderProcessorFacet`)
- `CircleOrderMetricsByMonth`: granular order-type counts
- `CircleScoreState` entity extracted from `CircleMetrics`
- User `totalVolume` and `ordersCount` tracking

### Fixed

- Use actual settlement time in dispute rollback instead of average
- Removed duplicate `AdditionalOrderDetails` handler
- Merchant reassign nullable field fix

---

## [0.6.0] — 2024

### Added

- Circle score calculation and `CircleScore` entity (#9)
- Campaign entities and reward claiming (#8)
- Payment channel migration data and completed/cancelled order totals (#5)
- Dispute `settledAt` and `placedAt` timestamps
- Fiat balance in payment channels
- FCM token indexing for merchant notifications

### Fixed

- Hex to UTF-8 conversion for string fields

---

## [0.5.0] — 2024

### Added

- Volume tracking entities (`OrderVolumeByMonth`, `OrderVolumeByDay`) (#4)
- Rewards indexing: `MerchantReward`, `CircleAdminReward` (#2)
- `paidAt` timestamp for sell/pay orders
- `cancelledAt` timestamp on orders
- Telegram handle change support

---

## [0.4.0] — 2024

### Added

- COT (Change of Terms) order flow support
- First-order-completed tracking per merchant
- Active merchant count metric

---

## [0.1.0] — 2024

### Added

- Initial subgraph scaffold targeting Base Sepolia
- `CircleFacet`, `USDCStakeDelegationFacet`, `OrderFlowFacet`, `OrderProcessorFacet` data sources
- `MerchantOnboardFacet`, `MerchantRegistryFacet`, `RewardsFacet`, `CountryFacet` data sources
- `ReputationManager` standalone contract indexing
- Core entities: `User`, `Circle`, `Orders`, `CircleMerchant`, `Staker`, `Rewards`
