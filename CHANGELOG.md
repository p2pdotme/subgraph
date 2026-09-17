# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

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
