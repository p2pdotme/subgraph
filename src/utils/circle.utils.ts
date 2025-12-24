import { Bytes, ethereum } from "@graphprotocol/graph-ts";
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

export function loadCircleMetrics(key: Bytes, event: ethereum.Event): CircleMetrics {
  let circleMetrics = CircleMetrics.load(key);
  if (!circleMetrics) {
    circleMetrics = new CircleMetrics(key);
  }

  circleMetrics.blockNumber = event.block.number;
  circleMetrics.blockTimestamp = event.block.timestamp;
  circleMetrics.transactionHash = event.transaction.hash;

  return circleMetrics;
}
