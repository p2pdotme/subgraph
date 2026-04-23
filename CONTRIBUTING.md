# Contributing to event-indexer

Thank you for your interest in contributing! This is a [The Graph](https://thegraph.com) subgraph that indexes on-chain events for the p2p.me protocol on Base and Base Sepolia.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- [Graph CLI](https://github.com/graphprotocol/graph-tooling) (`npm i -g @graphprotocol/graph-cli`)

### Local Setup

```bash
git clone https://github.com/p2pdotme/event-indexer.git
cd event-indexer
npm install
npm run codegen   # generate AssemblyScript types from schema + ABIs
npm run build     # compile mappings
```

For a full local Graph Node, copy the env file and start Docker:

```bash
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD
docker-compose up -d
npm run create-local
npm run deploy-local
```

---

## Development Workflow

1. **Fork** the repository and create a branch from `dev`:
   ```bash
   git checkout -b feat/my-feature dev
   ```

2. **Make your changes** — mappings live in `src/`, the schema in `schema.graphql`, and ABI files in `abis/`.

3. **Regenerate types** after any schema or ABI change:
   ```bash
   npm run codegen
   ```

4. **Build** to catch compile errors:
   ```bash
   npm run build
   ```

5. **Run tests** (uses [Matchstick](https://github.com/LimeChain/matchstick)):
   ```bash
   npm test
   ```

6. **Format** your code before committing:
   ```bash
   npm run format
   ```

---

## Submitting Changes

- Open pull requests against the `dev` branch (not `main`).
- Keep PRs focused — one feature or fix per PR.
- Write a clear description of **what** changed and **why**.
- Reference any related issues with `Fixes #<issue>` or `Relates to #<issue>`.
- All PRs require at least one approving review before merge.

### Commit Message Format

```
<type>: <short description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

Examples:
```
feat: index MerchantBlacklisted event
fix: correct startBlock for ReputationManager on Base mainnet
docs: update README with new entity descriptions
```

---

## Code Style

- Prettier is configured — run `npm run format` before committing.
- Prefer descriptive variable names over abbreviations.
- Add a comment above each event handler explaining what it does.
- Keep handler functions small; extract shared logic into `src/lib/`.

---

## Reporting Bugs

Please [open an issue](https://github.com/p2pdotme/event-indexer/issues/new) with:

- A clear description of the bug
- Steps to reproduce
- Expected vs actual behaviour
- Relevant block numbers or transaction hashes if applicable

For security vulnerabilities, see [SECURITY.md](./SECURITY.md).
