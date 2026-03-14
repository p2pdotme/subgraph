# Event Indexer

A [Graph Protocol](https://thegraph.com/studio/) subgraph that indexes smart contract events from a peer-to-peer marketplace deployed on **Base** and **Base Sepolia**. Built with AssemblyScript, compiled to WebAssembly, and served as a GraphQL API.

The marketplace operates around **Circles** (communities) where merchants register, users place orders (BUY/SELL/PAY), stake USDC, earn rewards, and build reputation.

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Docker** & **Docker Compose** (for local graph-node)
- **Graph CLI** (installed as project dependency)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Generate types from ABIs and schema

```bash
npm run codegen
```

> Run this every time you modify `schema.graphql` or any ABI file in `abis/`.

### 3. Build the subgraph

```bash
npm run build
```

### 4. Local deployment (optional)

Start the local graph-node stack (graph-node, IPFS, PostgreSQL):

```bash
docker-compose up -d
```

Create and deploy the subgraph locally:

```bash
npm run create-local
npm run deploy-local
```

Once running, the GraphQL playground is available at `http://localhost:8000`.

### 5. Studio deployment

```bash
npm run deploy
```

Deploys to The Graph Studio at `https://thegraph.com/studio/`.

---

## Network Configuration

Contract addresses per network are defined in `networks.json`:

| Network | Diamond Proxy | ReputationManager |
|---------|--------------|-------------------|
| `base` | `0x4cad6eC90e65baBec9335cAd728DDC610c316368` | `0xCF613e08EE1B4c2669DdCf06A7d22c9856f6Aa1D` |

All data sources (except ReputationManager) point to the same diamond proxy contract.

---

## Entity Relationship Diagram

### User Entities

```mermaid
erDiagram
    User {
        Bytes address
        BigInt reputationPoint
        boolean isBlacklisted
        Bytes primaryRecommender
        BigInt firstOrderCompletedAt
        Bytes firstOrderCompletedCurrency
        BigInt recentOrderCompletedAt
        Bytes recentOrderCompletedCurrency
    }

    SocialVerified {
        string socialName
        boolean verified
        BigInt timestamp
    }

    ReputationChange {
        Bytes admin
        Bytes user
        BigInt rpChange
    }

    UserRecommendation {
        Bytes recommender
        Bytes recipient
        BigInt timestamp
    }

    CampaignRewardRedeemed {
        BigInt campaignId
        Bytes manager
        BigInt rpReward
        BigInt usdcReward
    }

    User ||--o{ SocialVerified : "social verifications"
    User ||--o{ CampaignRewardRedeemed : "campaign claims"
    User ||--o{ Orders : "placed orders"
```

### Order Entities

```mermaid
erDiagram
    Orders {
        BigInt orderId
        Int type
        Int status
        BigInt circleId
        Bytes userAddress
        BigInt usdcAmount
        BigInt fiatAmount
        Bytes currency
        BigInt placedAt
        BigInt acceptedAt
        BigInt paidAt
        BigInt completedAt
        BigInt cancelledAt
        Bytes cancelledBy
        BigInt fixedFeePaid
        BigInt tipsPaid
        BigInt actualUsdcAmount
        BigInt actualFiatAmount
        Int disputeStatus
        Int disputeFaultType
        BigInt disputePlacedAt
        BigInt disputeSettledAt
    }

    AssignedMerchants {
        string assignedMerchant
        BigInt assignedPCId
        BigInt orderId
    }

    Orders ||--o{ AssignedMerchants : "assigned merchants"
    Orders }o--|| Circle : "belongs to"
    Orders }o--o| CircleMerchant : "accepted by"
```

### Merchant Entities

```mermaid
erDiagram
    CircleMerchant {
        string merchant
        string telegramId
        BigInt circleId
        BigInt stakedAmount
        BigInt delegatedStakedAmount
        boolean isOnline
        boolean isBlacklisted
        boolean isOngoingOrder
        boolean isUnstakeRequested
        BigInt unstakeAmount
        BigInt onlineAt
        BigInt offlineAt
        Bytes currency
    }

    MerchantPaymentChannels {
        BigInt pcConfigId
        BigInt accountNo
        string label
        boolean isActive
        Int status
        boolean isMonthlyVolumeUnlimited
        BigInt fiatBalance
        BigInt dailyVolume
        BigInt monthlyVolume
    }

    MerchantVolumeByMonth {
        string month
        BigInt volume
    }

    MerchantOrderMetricsByMonth {
        string month
        BigInt completedBuyOrdersCount
        BigInt completedSellOrdersCount
        BigInt completedPayOrdersCount
        BigInt cancelledBuyOrdersCount
        BigInt cancelledSellOrdersCount
        BigInt cancelledPayOrdersCount
    }

    MerchantDelegationRecord {
        string type
        BigInt amount
        BigInt balanceAfter
    }

    PaymentChannelMigration {
        BigInt fromAccountNo
        BigInt toAccountNo
        BigInt status
        BigInt fromFiatBalance
        BigInt toFiatBalance
    }

    FCMToken {
        Bytes address
        StringArray tokens
    }

    MerchantRewards {
        BigInt lockedRewards
        BigInt earnedRewards
        BigInt withdrawnRewards
        BigInt claimableRewards
    }

    MerchantReferralClaimed {
        Bytes recommender
        Bytes recipient
    }

    MerchantReferralRevenueClaimed {
        BigInt yearMonthKey
        BigInt reward
    }

    MerchantWithdrawFeePercentage {
        Bytes currency
        BigInt feePercentage
    }

    CircleMerchant ||--o{ MerchantPaymentChannels : "payment channels"
    CircleMerchant ||--o{ MerchantVolumeByMonth : "monthly volume"
    CircleMerchant ||--o{ MerchantOrderMetricsByMonth : "monthly order stats"
    CircleMerchant ||--o{ MerchantDelegationRecord : "delegation history"
    CircleMerchant ||--o{ PaymentChannelMigration : "migration requests"
    CircleMerchant ||--o{ FCMToken : "push tokens"
    CircleMerchant ||--o{ MerchantReferralRevenueClaimed : "referral revenue"
    CircleMerchant ||--o{ Orders : "accepted orders"
    CircleMerchant ||--o{ AssignedMerchants : "order assignments"
    CircleMerchant }o--|| Circle : "registered in"
    MerchantVolumeByMonth }o--|| MerchantPaymentChannels : "per channel"
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run codegen` | Generate TypeScript types from ABIs and schema |
| `npm run build` | Compile AssemblyScript to WebAssembly |
| `npm run deploy` | Deploy to The Graph Studio |

---

## Circle Score & Order Routing

The system assigns incoming orders to the best available circle using a **trust-weighted scoring** mechanism. Each circle earns a score from 0 to 100 based on its performance. Higher-scoring circles receive more orders.

### Circle Lifecycle

Every circle goes through these statuses:

```
                    ┌─────────────┐
         Created───►│  bootstrap   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            │            ▼
     ┌────────────┐        │     ┌────────────┐
     │   active    │◄───────┘     │  rejected   │
     └─────┬──────┘              └────────────┘
           │                           ▲
           ▼                           │
     ┌────────────┐                    │
     │   paused    │────────────────────┘
     └─────┬──────┘
           │
           ▼
     ┌────────────┐
     │   active    │  (recovers when settlement improves)
     └────────────┘
```

- **bootstrap** — New circle. Starts with `score = 50`. Receives orders to prove itself.
- **active** — Graduated circle. Fully participates in order routing.
- **paused** — Settlement too slow (>600s avg). Gets fewer orders but can recover.
- **rejected** — Permanently blocked. Never receives orders again.

### Step 1: Trust Firewall (runs first on every score update)

Before anything else, the system checks if a circle should be blocked or paused:

```
if dispute_rate > 12%  →  status = rejected, score = 0   (permanent ban)
if avg_settlement > 600s  →  status = paused              (reduced orders)
```

- **Rejected** circles are permanently removed from order routing.
- **Paused** circles still get a small chance at orders (via exploration), giving them an opportunity to improve settlement times and return to active.
- If a paused circle brings its avg settlement back to ≤600s, it automatically becomes **active** again.

### Step 2: Bootstrap Phase (new circles)

When a circle is first created, it enters **bootstrap** with a default score of 50. This gives new circles a fair chance to receive orders and build a track record.

**Graduation to active** happens when either threshold is met:

| Threshold | Value |
|-----------|-------|
| Lifetime orders | ≥ 40 |
| Lifetime USDC volume | ≥ 20,000 USDC |

**Fast reject during bootstrap** — The system doesn't wait for 40 orders to decide a circle is bad. If the dispute rate exceeds 20% during bootstrap, the circle is immediately **rejected**.

### Step 3: Circle Score Calculation (0–100)

The score is only computed when:
- Circle is **not rejected**
- Circle has completed at least **10 orders** (MIN_ORDERS_FOR_SCORE)

The score is a weighted combination of 4 sub-scores, each ranging from 0 to 100:

```
score = 0.35 × speed + 0.30 × dispute + 0.20 × merchants + 0.15 × volume
```

#### 3a. Speed Score (35% weight)

Measures how fast merchants settle orders (time from paid to completed, for SELL/PAY orders). Calculated over a **rolling 30-day window**.

```
speed = clamp(100 × (150 - avg_settlement_seconds) / (150 - 45), 0, 100)
```

- 45 seconds = best case (score 100)
- 150 seconds = worst case (score 0)

| Avg Settlement | Speed Score |
|---------------|-------------|
| 45s | 100 |
| 60s | ~86 |
| 75s | ~71 |
| 90s | ~57 |
| 120s | ~29 |
| 150s+ | 0 |

#### 3b. Dispute Score (30% weight)

Penalizes circles with high dispute rates. Lower disputes = higher score.

```
dispute = max(0, 100 - (dispute_rate × 1800))
```

| Dispute % | Score |
|-----------|-------|
| 0.0% | 100 |
| 0.5% | 91 |
| 1.0% | 82 |
| 2.0% | 64 |
| 3.0% | 46 |
| 5.0% | 10 |
| ≥5.6% | 0 |

#### 3c. Merchants Score (20% weight)

Rewards circles with more active merchants (merchants with staked amount > 0).

```
merchants = min(100, active_merchants)
```

Simply counts active merchants, capped at 100.

#### 3d. Volume Score (15% weight)

Rewards circles with higher 30-day USDC trading volume.

```
volume = min(100, total_volume_usdc / 10,000)
```

| Total Volume (USDC) | Volume Score |
|--------------------|-------------|
| 0 | 0 |
| 50,000 | 5 |
| 100,000 | 10 |
| 250,000 | 25 |
| 500,000 | 50 |
| ≥1,000,000 | 100 |

### Step 4: Order Routing (Epsilon-Greedy)

Orders are assigned to circles using an **epsilon-greedy bandit** algorithm. This balances between picking the best circle (exploitation) and giving other circles a chance (exploration).

```
EPSILON = 0.25          →  25% of orders explore
1 - EPSILON = 0.75      →  75% of orders exploit
RECOVERY_SCALE = 0.3    →  paused circles get 30% of their score as weight
```

**How it works:**

1. A random number is generated (0 to 1)
2. **75% of the time (exploit):** Pick from **active circles only**, weighted by score. Higher-scoring circles get proportionally more orders.
3. **25% of the time (explore):** Pick from **all eligible circles** (including paused). Paused circles' weights are scaled down by 0.3x, giving them a small but real chance to recover.

**Example with 5 circles:**

| Circle | Status | Score | Exploit Prob | Explore Prob | Overall Prob |
|--------|--------|-------|-------------|-------------|-------------|
| A | active | 90 | 40.9% | 34.0% | 39.2% |
| B | active | 70 | 31.8% | 26.4% | 30.4% |
| E | active | 60 | 27.3% | 22.6% | 26.1% |
| C | paused | 50 | 0% | 9.4% | 2.35% |
| D | paused | 40 | 0% | 7.5% | 1.9% |

Active circles A, B, E receive ~95% of orders proportional to their scores. Paused circles C, D still get ~4% of orders combined, giving them a path to recovery.

### 30-Day Rolling Window

All metrics (settlement time, dispute rate, volume) are computed over a **rolling 30-day window** using daily buckets (`CircleDailyMetrics` entity).

- Each day's data is stored in a separate bucket (keyed by `circleId-dayNumber`)
- On every order completion, the system scans the last 30 daily buckets and sums up the metrics
- This means a bad week 5 weeks ago no longer affects the score — circles can recover by performing well recently

### When is the score recalculated?

The circle score is recomputed on every **order completion** event. This keeps scores up-to-date as new performance data comes in.

### Example: Two Circles Compared

Let's walk through two circles with different performance profiles to see how the scoring works end-to-end.

#### Raw Metrics

| Metric | Circle Alpha | Circle Beta |
|--------|-------------|------------|
| Avg Settlement Time | 60s | 120s |
| Dispute Rate | 1.0% | 4.0% |
| Active Merchants | 25 | 8 |
| 30d Volume (USDC) | 500,000 | 50,000 |
| Lifetime Orders | 200 | 15 |
| Status | active | bootstrap |

#### Sub-Score Breakdown

**Circle Alpha:**
```
speed    = clamp(100 × (150 - 60) / (150 - 45), 0, 100)  = 85.7  ≈ 86
dispute  = max(0, 100 - (0.01 × 1800))                    = 82
merchants = min(100, 25)                                    = 25
volume   = min(100, 500,000 / 10,000)                      = 50
```

**Circle Beta:**
```
speed    = clamp(100 × (150 - 120) / (150 - 45), 0, 100)  = 28.6  ≈ 29
dispute  = max(0, 100 - (0.04 × 1800))                     = 28
merchants = min(100, 8)                                      = 8
volume   = min(100, 50,000 / 10,000)                        = 5
```

#### Final Score Calculation

```
Circle Alpha = 0.35 × 86 + 0.30 × 82 + 0.20 × 25 + 0.15 × 50
             = 30.1    + 24.6    + 5.0     + 7.5
             = 67.2  →  67

Circle Beta  = 0.35 × 29 + 0.30 × 28 + 0.20 × 8  + 0.15 × 5
             = 10.15   + 8.4     + 1.6    + 0.75
             = 20.9  →  21
```

#### Score Comparison Chart

```mermaid
xychart-beta
    title "Circle Score Breakdown"
    x-axis ["Speed (35%)", "Dispute (30%)", "Merchants (20%)", "Volume (15%)", "Final Score"]
    y-axis "Score (0-100)" 0 --> 100
    bar [86, 82, 25, 50, 67]
    bar [29, 28, 8, 5, 21]
```

#### Order Routing Outcome

With both circles active and eligible, here's how orders would be distributed:

```
Total weight = 67 (Alpha) + 21 (Beta) = 88

Circle Alpha probability = 67 / 88 = 76.1%
Circle Beta probability  = 21 / 88 = 23.9%
```

```mermaid
pie title Order Distribution (out of 100 orders)
    "Circle Alpha (score 67)" : 76
    "Circle Beta (score 21)" : 24
```

**What this means:**
- Out of every 100 orders, Circle Alpha gets ~76 and Circle Beta gets ~24.
- Circle Alpha dominates because it settles 2x faster (60s vs 120s), has 4x fewer disputes (1% vs 4%), has 3x more merchants, and 10x more volume.
- Circle Beta can improve its share by: reducing settlement time, lowering disputes, onboarding more merchants, or increasing volume. The score recalculates on every completed order, so improvements are reflected immediately.
