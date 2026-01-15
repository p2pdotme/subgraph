import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  OrderCompleted as OrderCompletedEvent,
  BuyOrderPaid as BuyOrderPaidEvent,
  OrderAccepted as OrderAcceptedEvent,
} from "../generated/OrderFlowHelper/OrderFlowHelper";
import { OrderDispute as OrderDisputeEvent } from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import {
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  syncOrder,
} from "./utils";
import { CircleMetrics } from "../generated/schema";
import {
  DISPUTE_STATUS_RAISED,
  DISPUTE_STATUS_SETTLED,
} from "./constants/status";
import {
  CancelledOrders as CancelledOrdersEvent,
  OrderPlaced as OrderPlacedEvent,
  SellOrderUpiSet as SellOrderUpiSetEvent,
  MerchantAssignedNewOrder as MerchantAssignedNewOrderEvent,
  MerchantReAssignedNewOrder as MerchantReAssignedNewOrderEvent,
} from "../generated/OrderFlowFacet/OrderFlowFacet";

export function handleOrderCompleted(event: OrderCompletedEvent): void {
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );

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
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
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
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );

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
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );

  const circle = loadCircle(
    changetype<Bytes>(Bytes.fromBigInt(event.params._order.circleId)),
    event
  );

  if (!circle) return;

  let circleMetrics = loadCircleMetrics(circle.id, event);

  if (!circleMetrics) return;

  circleMetrics.totalPlacedOrdersCount =
    circleMetrics.totalPlacedOrdersCount.plus(BigInt.fromI32(1));

  circleMetrics.circle = circle.id;

  circleMetrics.save();
}

export function handleMerchantAssignedNewOrder(
  event: MerchantAssignedNewOrderEvent
): void {
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );
}

export function handleMerchantReAssignedNewOrder(
  event: MerchantReAssignedNewOrderEvent
): void {
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );
}

export function handleSellOrderUpiSet(event: SellOrderUpiSetEvent): void {
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );
}

export function handleBuyOrderPaid(event: BuyOrderPaidEvent): void {
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );
}

export function handleOrderAccepted(event: OrderAcceptedEvent): void {
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency.toString(),
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event
  );
}
