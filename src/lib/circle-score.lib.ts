import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CircleDailyMetrics,
  CircleMetrics,
  CircleScoreState,
} from "../../generated/schema";
import {
  MIN_ORDERS_FOR_SCORE,
  WEIGHT_SPEED,
  WEIGHT_DISPUTE,
  WEIGHT_MERCHANTS,
  WEIGHT_VOLUME,
  MIN_SETTLEMENT_SECONDS,
  MAX_SETTLEMENT_SECONDS,
  DISPUTE_RATE_MULTIPLIER,
  VOLUME_THRESHOLD_USDC,
  MERCHANTS_THRESHOLD,
  DISPUTE_RATE_SCALE,
  ROLLING_WINDOW_DAYS,
  SECONDS_PER_DAY,
  MAX_SETTLEMENT_FOR_PAUSE,
  BOOTSTRAP_ORDERS,
  BOOTSTRAP_USDC_VOLUME,
  STATUS_BOOTSTRAP,
  STATUS_ACTIVE,
  STATUS_REJECTED,
  STATUS_PAUSED,
} from "../constants/circle-score";

function clamp(value: i32, min: i32, max: i32): i32 {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Calculate speed score: clamp(100 * (150 - avg) / (150 - 45), 0, 100)
 */
function calculateSpeedScore(avgSettlementSeconds: BigInt): i32 {
  const avgSeconds = avgSettlementSeconds.toI32();

  if (avgSeconds >= MAX_SETTLEMENT_SECONDS) return 0;
  if (avgSeconds <= MIN_SETTLEMENT_SECONDS) return 100;

  const numerator = 100 * (MAX_SETTLEMENT_SECONDS - avgSeconds);
  const denominator = MAX_SETTLEMENT_SECONDS - MIN_SETTLEMENT_SECONDS;
  const score = numerator / denominator;

  return clamp(score, 0, 100);
}

/**
 * Calculate dispute score: max(0, 100 - (dispute_rate * 1800 / 10000))
 * disputeRate is stored as rate × 10000
 */
function calculateDisputeScore(disputeRate: BigInt): i32 {
  const penalty =
    (disputeRate.toI32() * DISPUTE_RATE_MULTIPLIER) / DISPUTE_RATE_SCALE;
  const score = 100 - penalty;

  return score > 0 ? score : 0;
}

/**
 * Calculate merchants score: min(100, active_merchants)
 */
function calculateMerchantsScore(activeMerchantsCount: BigInt): i32 {
  const count = activeMerchantsCount.toI32();
  return count > MERCHANTS_THRESHOLD ? MERCHANTS_THRESHOLD : count;
}

/**
 * Calculate volume score: min(100, volume / (threshold / 100))
 * Uses 30d rolling volume
 */
function calculateVolumeScore(volume: BigInt): i32 {
  if (volume.ge(BigInt.fromI64(VOLUME_THRESHOLD_USDC))) {
    return 100;
  }

  const divisor = BigInt.fromI64(VOLUME_THRESHOLD_USDC / 100);
  const score = volume.div(divisor).toI32();

  return score > 100 ? 100 : score;
}

/**
 * Recompute 30d rolling metrics from CircleDailyMetrics buckets
 */
export function compute30dMetrics(
  scoreState: CircleScoreState,
  currentTimestamp: BigInt,
): void {
  const currentDay = currentTimestamp.toI32() / SECONDS_PER_DAY;
  let totalSettlement = BigInt.zero();
  let totalCompletedOrders = BigInt.zero();
  let totalAcceptedOrders = BigInt.zero();
  let totalDisputes = BigInt.zero();
  let totalVolume = BigInt.zero();

  for (let i = 0; i < ROLLING_WINDOW_DAYS; i++) {
    const dayNum = currentDay - i;
    const dayKey = Bytes.fromUTF8(
      scoreState.id.toHexString() + "-" + dayNum.toString(),
    );
    const daily = CircleDailyMetrics.load(dayKey);
    if (daily) {
      totalSettlement = totalSettlement.plus(daily.settlementSecondsSum);
      totalCompletedOrders = totalCompletedOrders.plus(
        daily.completedOrdersCount,
      );
      totalAcceptedOrders = totalAcceptedOrders.plus(daily.acceptedOrdersCount);
      totalDisputes = totalDisputes.plus(daily.merchantFaultDisputesCount);
      totalVolume = totalVolume.plus(daily.volume);
    }
  }

  // Avg settlement (30d) — uses SELL/PAY completed orders only
  if (totalCompletedOrders.gt(BigInt.zero())) {
    scoreState.avgSettlementSeconds =
      totalSettlement.div(totalCompletedOrders);
  } else {
    scoreState.avgSettlementSeconds = BigInt.zero();
  }

  // Dispute rate (30d) = merchant fault disputes / accepted orders × 10000
  if (totalAcceptedOrders.gt(BigInt.zero())) {
    scoreState.disputeRate = totalDisputes
      .times(BigInt.fromI32(DISPUTE_RATE_SCALE))
      .div(totalAcceptedOrders);
  } else {
    scoreState.disputeRate = BigInt.zero();
  }

  // Store 30d volume for volume score calculation
  scoreState.rolling30dVolume = totalVolume;
}

/**
 * Update circle score based on current metrics
 * Formula: 0.35*speed + 0.30*dispute + 0.20*merchants + 0.15*volume
 * Score stored as plain 0–100
 */
export function updateCircleScore(
  circleMetrics: CircleMetrics,
  scoreState: CircleScoreState,
): void {
  // Skip if rejected (set by on-chain CircleStatusUpdated event)
  if (circleMetrics.circleStatus == STATUS_REJECTED) {
    return;
  }

  // Check minimum orders threshold using lifetime accepted orders
  if (
    scoreState.lifetimeAcceptedOrders.lt(
      BigInt.fromI32(MIN_ORDERS_FOR_SCORE),
    )
  ) {
    circleMetrics.hasMinOrdersForScore = false;
    return;
  }

  circleMetrics.hasMinOrdersForScore = true;

  // Calculate component scores
  const speedScore = calculateSpeedScore(scoreState.avgSettlementSeconds);
  const disputeScore = calculateDisputeScore(scoreState.disputeRate);
  const merchantsScore = calculateMerchantsScore(
    scoreState.activeMerchantsCount,
  );
  const volumeScore = calculateVolumeScore(scoreState.rolling30dVolume);

  // Apply weights: weighted sum out of 10000
  const weightedScore =
    speedScore * WEIGHT_SPEED +
    disputeScore * WEIGHT_DISPUTE +
    merchantsScore * WEIGHT_MERCHANTS +
    volumeScore * WEIGHT_VOLUME;

  // Divide by 100 to get score out of 100
  const finalScore = weightedScore / 100;

  // Store as plain 0–100
  circleMetrics.circleScore = BigInt.fromI32(finalScore);
}

/**
 * Trust Firewall: enforce hard limits on circle metrics
 * - Rejection is now handled on-chain via CircleStatusUpdated event
 * - avgSettlement > 600s → paused (recovers when ≤ 600s)
 */
export function applyTrustFirewall(
  circleMetrics: CircleMetrics,
  scoreState: CircleScoreState,
): void {
  // Rejected is set by on-chain CircleStatusUpdated event — don't override
  if (circleMetrics.circleStatus == STATUS_REJECTED) {
    return;
  }

  // Avg settlement > 600s → paused
  if (
    scoreState.avgSettlementSeconds.gt(
      BigInt.fromI32(MAX_SETTLEMENT_FOR_PAUSE),
    ) &&
    scoreState.avgSettlementSeconds.gt(BigInt.zero())
  ) {
    circleMetrics.circleStatus = STATUS_PAUSED;
  } else if (circleMetrics.circleStatus == STATUS_PAUSED) {
    // Recovered — check if circle meets graduation criteria
    if (
      scoreState.lifetimeAcceptedOrders.ge(
        BigInt.fromI32(BOOTSTRAP_ORDERS),
      ) ||
      circleMetrics.totalVolume.ge(BigInt.fromI64(BOOTSTRAP_USDC_VOLUME))
    ) {
      circleMetrics.circleStatus = STATUS_ACTIVE;
    } else {
      circleMetrics.circleStatus = STATUS_BOOTSTRAP;
    }
  }
}

/**
 * Check if a bootstrap circle should graduate to active
 * Graduates when: lifetime accepted orders >= 40 OR total volume >= 20K USDC
 */
export function checkBootstrapGraduation(
  circleMetrics: CircleMetrics,
  scoreState: CircleScoreState,
): void {
  if (circleMetrics.circleStatus != STATUS_BOOTSTRAP) {
    return;
  }

  if (
    scoreState.lifetimeAcceptedOrders.ge(BigInt.fromI32(BOOTSTRAP_ORDERS)) ||
    circleMetrics.totalVolume.ge(BigInt.fromI64(BOOTSTRAP_USDC_VOLUME))
  ) {
    circleMetrics.circleStatus = STATUS_ACTIVE;
  }
}

/**
 * Update settlement time with new order (SELL/PAY only, paidAt→completedAt)
 */
export function updateSettlementTime(
  scoreState: CircleScoreState,
  settlementSeconds: BigInt,
): void {
  scoreState.cumulativeSettlementSeconds =
    scoreState.cumulativeSettlementSeconds.plus(settlementSeconds);

  scoreState.completedSellPayOrders = scoreState.completedSellPayOrders.plus(
    BigInt.fromI32(1),
  );

  scoreState.avgSettlementSeconds =
    scoreState.cumulativeSettlementSeconds.div(
      scoreState.completedSellPayOrders,
    );
}

/**
 * A merchant is "active" when: stakedAmount > 0, isOnline, and not blacklisted.
 */
export function isMerchantActive(
  stakedAmount: BigInt,
  isOnline: boolean,
  isBlacklisted: boolean,
): boolean {
  return stakedAmount.gt(BigInt.zero()) && isOnline && !isBlacklisted;
}

/**
 * Update active merchants count based on active status transitions.
 */
export function updateActiveMerchantsCount(
  scoreState: CircleScoreState,
  wasActive: boolean,
  isActive: boolean,
): void {
  if (!wasActive && isActive) {
    scoreState.activeMerchantsCount =
      scoreState.activeMerchantsCount.plus(BigInt.fromI32(1));
  } else if (wasActive && !isActive) {
    if (scoreState.activeMerchantsCount.gt(BigInt.zero())) {
      scoreState.activeMerchantsCount =
        scoreState.activeMerchantsCount.minus(BigInt.fromI32(1));
    }
  }
}
