import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Circle, CircleMetrics } from "../../generated/schema";

export const loadCircle = (key: Bytes, event: ethereum.Event): Circle => {
  let circle = Circle.load(key);
  if (!circle) {
    circle = new Circle(key);
  }

  circle.blockNumber = event.block.number;
  circle.blockTimestamp = event.block.timestamp;
  circle.transactionHash = event.transaction.hash;

  return circle;
};

export function loadCircleMetrics(
  key: Bytes,
  event: ethereum.Event
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
  }

  circleMetrics.blockNumber = event.block.number;
  circleMetrics.blockTimestamp = event.block.timestamp;
  circleMetrics.transactionHash = event.transaction.hash;

  return circleMetrics;
}

export function loadCircleOrderMetricsByMonth(
  key: Bytes,
  event: ethereum.Event
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
