# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Graph Protocol subgraph (AssemblyScript → WASM) that indexes Ethereum smart contract events from a peer-to-peer marketplace on Base/Base Sepolia. The marketplace operates around **circles** (communities) with merchants, orders (BUY/SELL/PAY), staking, rewards, and reputation systems.

## Build & Development Commands

```bash
npm install              # Install dependencies
npm run codegen          # Generate TypeScript types from ABIs and schema (run after schema/ABI changes)
npm run build            # Compile AssemblyScript to WASM (runs codegen first implicitly)
npm test                 # Run tests (matchstick-as framework)
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without modifying
npm run deploy           # Deploy to The Graph Studio
npm run create-local     # Create local subgraph (requires Docker)
npm run deploy-local     # Deploy to local graph-node
```

Local development stack (graph-node, IPFS, PostgreSQL) is available via `docker-compose up`.

## Architecture

### Event Handler Pattern

Each smart contract facet has a corresponding handler file in `src/`. Event handlers follow a consistent pattern:
1. Load or create entities using loader functions from `src/lib/`
2. Update entity fields from event parameters
3. Save entities

The loader functions (`load*` in `src/lib/`) handle the load-or-create pattern: they attempt to load an entity by ID, and if it doesn't exist, create a new one with default values and timestamps.

### Key Source Files

- **`src/order.ts`** — Largest and most complex file. Handles order lifecycle (placement, acceptance, payment, completion, cancellation, disputes) and triggers circle score recalculations.
- **`src/circle-merchants.ts`** — Merchant registration, status toggles, staking, payment channel migrations.
- **`src/reputation-manager.ts`** — User reputation, KYC/social verification, campaigns, referrals.
- **`src/lib/circle-score.lib.ts`** — Circle scoring algorithm with speed scores, dispute rates, trust firewall, and bootstrap graduation logic. Uses 30-day rolling window via `CircleDailyMetrics`.

### Data Flow

`subgraph.yaml` defines 11 data sources (contract facets), all pointing to the same diamond proxy contract (except ReputationManager). Events flow: **Smart Contract → Event Handler → Entity Loaders → GraphQL Store**.

### Metrics Layers

Three granularities of metrics aggregation:
- **Instant**: Direct entity fields (e.g., `Orders`, `CircleMerchant`)
- **Daily**: `CircleDailyMetrics` — 30-day rolling window for circle scoring
- **Monthly**: `*ByMonth` entities for volume and order tracking

### Configuration

- **`subgraph.yaml`** — Data sources, ABIs, event-to-handler mappings, start blocks
- **`networks.json`** — Contract addresses per network (base-sepolia, base)
- **`schema.graphql`** — All GraphQL entity definitions
- **`abis/`** — Smart contract ABI JSON files

## Language Notes

This project uses **AssemblyScript**, not TypeScript. Key differences:
- No union types, no `undefined`, no closures over mutable variables
- Use `BigInt` and `BigDecimal` for numeric operations (from `@graphprotocol/graph-ts`)
- String concatenation for entity IDs (e.g., `circleId + "-" + oderId`)
- Entity references use string IDs, not object references
- `store.remove()` for deleting entities; `.save()` to persist changes

## Conventions

- Entity ID format: composite keys joined with `-` (e.g., `circleId-oderId`, `oderId-merchant`)
- Status constants defined in `src/constants/status.ts`
- Circle scoring constants in `src/constants/circle-score.ts`
- Date utility `getYearMonthFromTimestamp()` returns `"YYYY-MM"` format for monthly entity keys
- Prettier config: double quotes, semicolons, 2-space indent, trailing commas
