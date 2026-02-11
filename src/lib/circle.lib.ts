import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Circle,
  CircleDailyMetrics,
  CircleMetrics,
  CircleOrderMetricsByMonth,
} from "../../generated/schema";
import { STATUS_BOOTSTRAP, SECONDS_PER_DAY } from "../constants/circle-score";

export const loadCircle = (key: Bytes, event: ethereum.Event): Circle => {
  let circle = Circle.load(key);
  if (!circle) {
    circle = new Circle(key);
    circle.circleId = BigInt.zero();
    circle.admin = "";
    circle.currency = Bytes.empty();
    circle.name = "";
    circle.communityLink = "";
    circle.isAutoApprovedPCEnabled = false;
  }

  circle.blockNumber = event.block.number;
  circle.blockTimestamp = event.block.timestamp;
  circle.transactionHash = event.transaction.hash;

  return circle;
};

export function loadCircleMetrics(
  key: Bytes,
  event: ethereum.Event,
): CircleMetrics {
  let circleMetrics = CircleMetrics.load(key);
  if (!circleMetrics) {
    circleMetrics = new CircleMetrics(key);
    circleMetrics.totalStaked = BigInt.zero();
    circleMetrics.adminStaked = BigInt.zero();
    circleMetrics.totalVolume = BigInt.zero();
    circleMetrics.resolvedDisputesCount = BigInt.zero();
    circleMetrics.raisedDisputesCount = BigInt.zero();
    circleMetrics.totalDelegatedStake = BigInt.zero();
    circleMetrics.totalMerchantsCount = BigInt.zero();
    circleMetrics.totalPlacedOrdersCount = BigInt.zero();
    // Initialize circle score fields
    circleMetrics.circleScore = BigInt.fromI32(50); // bootstrap default
    circleMetrics.circleStatus = STATUS_BOOTSTRAP;
    circleMetrics.avgSettlementSeconds = BigInt.zero();
    circleMetrics.disputeRate = BigInt.zero();
    circleMetrics.rolling30dVolume = BigInt.zero();
    circleMetrics.lifetimeAcceptedOrders = BigInt.zero();
    circleMetrics.cumulativeSettlementSeconds = BigInt.zero();
    circleMetrics.totalCompletedOrders = BigInt.zero();
    circleMetrics.activeMerchantsCount = BigInt.zero();
    circleMetrics.merchantFaultDisputesCount = BigInt.zero();
    circleMetrics.hasMinOrdersForScore = false;
    circleMetrics.lastScoreUpdateTimestamp = BigInt.zero();
  }

  circleMetrics.blockNumber = event.block.number;
  circleMetrics.blockTimestamp = event.block.timestamp;
  circleMetrics.transactionHash = event.transaction.hash;

  return circleMetrics;
}

export function loadCircleDailyMetrics(
  key: Bytes,
  event: ethereum.Event,
): CircleDailyMetrics {
  let daily = CircleDailyMetrics.load(key);
  if (!daily) {
    daily = new CircleDailyMetrics(key);
    daily.circle = Bytes.empty();
    daily.dayNumber = BigInt.zero();
    daily.settlementSecondsSum = BigInt.zero();
    daily.completedOrdersCount = BigInt.zero();
    daily.acceptedOrdersCount = BigInt.zero();
    daily.merchantFaultDisputesCount = BigInt.zero();
    daily.volume = BigInt.zero();
  }

  daily.blockNumber = event.block.number;
  daily.blockTimestamp = event.block.timestamp;
  daily.transactionHash = event.transaction.hash;

  return daily;
}

export function getDayNumber(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_DAY;
}

export function getDailyMetricsKey(circleId: Bytes, dayNumber: i32): Bytes {
  return Bytes.fromUTF8(circleId.toHexString() + "-" + dayNumber.toString());
}

export function loadCircleOrderMetricsByMonth(
  key: Bytes,
  event: ethereum.Event,
): CircleOrderMetricsByMonth {
  let metrics = CircleOrderMetricsByMonth.load(key);
  if (!metrics) {
    metrics = new CircleOrderMetricsByMonth(key);
    metrics.month = "";
    metrics.totalCompletedOrdersCount = BigInt.zero();
    metrics.totalCancelledOrdersCount = BigInt.zero();
  }

  metrics.blockNumber = event.block.number;
  metrics.blockTimestamp = event.block.timestamp;
  metrics.transactionHash = event.transaction.hash;

  return metrics;
}
