import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { OrderCompleted as OrderCompletedEvent} from "../generated/OrderFlowHelper/OrderFlowHelper";
import { OrderDispute as OrderDisputeEvent } from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import { loadCircle, loadCircleMerchant, loadCircleMetrics } from "./utils";
import { CircleMetrics } from "../generated/schema";
import { DISPUTE_STATUS_RAISED, DISPUTE_STATUS_SETTLED } from "./constants/status";
import { CancelledOrders as CancelledOrdersEvent, OrderPlaced as OrderPlacedEvent } from "../generated/OrderFlowFacet/OrderFlowFacet";

export function handleOrderCompleted(event: OrderCompletedEvent): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toString()),
    event
  );

  const circle =
    merchant && merchant.circle
      ? Bytes.fromHexString(merchant.circle.toString())
      : null;

  if (!circle) return;

  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

  circleMetrics.totalVolume = circleMetrics.totalVolume.plus(
    event.params._order.amount
  );

  circleMetrics.save();
}

/**
 * Updates the dispute metrics for a given circle metrics and event
 * @param circleMetrics - The circle metrics to update
 * @param event - The event to update the dispute metrics for
 */
const updateDisputeMetrics = (
  circleMetrics: CircleMetrics,
  event: OrderDisputeEvent
): void => {
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_RAISED) {
    circleMetrics.raisedDisputesCount = circleMetrics.raisedDisputesCount.plus(
      BigInt.fromI32(1)
    );
  } else if (event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED) {
    circleMetrics.raisedDisputesCount = circleMetrics.raisedDisputesCount.minus(
      BigInt.fromI32(1)
    );
    circleMetrics.resolvedDisputesCount =
      circleMetrics.resolvedDisputesCount.plus(BigInt.fromI32(1));
  }
};

export function handleOrderDispute(event: OrderDisputeEvent): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toString()),
    event
  );

  const circle =
    merchant && merchant.circle
      ? Bytes.fromHexString(merchant.circle.toString())
      : null;

  if (!circle) return;

  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

  updateDisputeMetrics(circleMetrics, event);

  circleMetrics.save();
}

export function handleCancelledOrders(event: CancelledOrdersEvent): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toString()),
    event
  );

  const circle =
    merchant && merchant.circle
      ? Bytes.fromHexString(merchant.circle.toString())
      : null;

  if (!circle) return;

  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;
  
  circleMetrics.save();
}

export function handleOrderPlaced(event: OrderPlacedEvent): void {
  const circle = loadCircle(
    changetype<Bytes>(Bytes.fromBigInt(event.params._order.circleId)),
    event
  );

  if (!circle) return;

  let circleMetrics = loadCircleMetrics(circle.id, event);

  if (!circleMetrics) return;

  circleMetrics.totalPlacedOrdersCount = circleMetrics.totalPlacedOrdersCount.plus(
    BigInt.fromI32(1)
  );
  
  circleMetrics.circle = circle.id;
  
  circleMetrics.save();
} 