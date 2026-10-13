# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-10

Goldsky `p2pme-subgraph/1.0.0`. **Full sync only**: entity ids for circles 1–9 differ from 0.3.x, so this version is never grafted.

### Added
- `ApprovedClaimCancelled`: an approver-cancelled APPROVED claim becomes REJECTED (#81)
- Merchant KPI daily metrics: per-merchant daily buckets, missed-order streaks, online/busy time (#75)
- Insurance: pool (#46), debt ledger events (#63), CALR lifecycle events (#72)
- USDC stake delegation: stake (#58) and cancel unstake (#60)
- Merchant `OrderAppealed` event (#62)
- B2BGatewayFacet indexing aligned with current contract events (#51)
- Governance facet (#49)
- Routing capacity signal for circle scoring (#64)
- MIT License and open-source community files (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`) (#47)
- `.env.example` for local docker-compose setup (#47)

### Changed
- `CirclePermission`, `CircleUsdcStakeRecords` and `CircleUsdcUnstakeRecords` ids are the UTF-8 bytes of `<circleId>-0x<account>` for every circle (#82)
- The manifest no longer declares `features: [grafting]` (#82)
- Insurance diamond address (#54) and circle URLs (#55) updated
- Replaced hardcoded postgres password in `docker-compose.yml` with `POSTGRES_PASSWORD` env var (#47)

### Fixed
- Indexing halted on 2-digit circle ids in `handlePermissionGranted` (prod stopped at block 52506326 on 12 Oct 2026); the stake-delegation handlers had the same key (#82)
- A 4-digit `accountNo` reached `BigInt.fromString("")` in `handleMonthlyVolumeUnlimitedFlagUpdated` (#82)
- Idle circle scores no longer inflated (#64)
- Payment-channel fiat balance tracked across insurance write-offs (#66)
- Circle persisted when a merchant is linked to it (#68); `CircleMerchant` circle links self-heal after provider log gaps (#74)
- Immutable entity errors; governor facet updated (#57)

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
