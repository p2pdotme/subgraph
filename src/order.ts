import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  OrderCompleted as OrderCompletedEvent,
  BuyOrderPaid as BuyOrderPaidEvent,
  OrderAccepted as OrderAcceptedEvent,
  AdditionalOrderDetails as AdditionalOrderDetailsEvent,
} from "../generated/OrderFlowHelper/OrderFlowHelper";
import { OrderDispute as OrderDisputeEvent, DisputeTransIdSet as DisputeTransIdSetEvent } from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import {
  loadAssignedMerchants,
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadOrders,
  syncOrder,
} from "./lib";
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
  OrderCancelledBy as OrderCancelledByEvent,
} from "../generated/OrderFlowFacet/OrderFlowFacet";

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
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params._order.id,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toHexString()),
    event
  );

  // merchant.circle is already Bytes - no conversion needed
  const circle = merchant.circle;

  // Check if circle is the default placeholder value (Bytes.fromI32(0))
  if (!circle || circle.equals(Bytes.fromI32(0))) return;

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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toHexString()),
    event
  );

  // merchant.circle is already Bytes - no conversion needed
  const circle = merchant.circle;

  // Check if circle is the default placeholder value (Bytes.fromI32(0))
  if (!circle || circle.equals(Bytes.fromI32(0))) return;

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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  const assignedMerchantKey = Bytes.fromHexString(
    `${event.params.orderId}-${event.params.accountNo}-${event.params.merchant}`
  );

  let assignedMerchant = loadAssignedMerchants(assignedMerchantKey, event);
  assignedMerchant.assignedMerchant = event.params.merchant.toHexString();
  assignedMerchant.merchant = merchant.id;
  assignedMerchant.orderId = event.params.orderId;
  assignedMerchant.assignedPCId = event.params.accountNo;
  assignedMerchant.save();

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event
  );

  let assignedMerchants = order.assignedMerchants;
  if (assignedMerchants == null) {
    assignedMerchants = [];
  }
  assignedMerchants.push(assignedMerchant.id);
  order.assignedMerchants = assignedMerchants;
  order.save();
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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  const assignedMerchantKey = Bytes.fromHexString(
    `${event.params.orderId}-${event.params.accountNo}-${event.params.merchant}`
  );
  let assignedMerchant = loadAssignedMerchants(assignedMerchantKey, event);
  assignedMerchant.merchant = merchant.id;
  assignedMerchant.orderId = event.params.orderId;
  assignedMerchant.assignedPCId = event.params.accountNo;
  assignedMerchant.save();

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event
  );

  let assignedMerchants = order.assignedMerchants;
  if (assignedMerchants == null) {
    assignedMerchants = [];
  }
  assignedMerchants.push(assignedMerchant.id);
  order.assignedMerchants = assignedMerchants;
  order.save();
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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event
  );
  order.paidAt = event.block.timestamp;
  order.save();
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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toHexString()),
    event
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event
  );
  order.acceptedPCId = event.params._order.acceptedAccountNo;
  order.acceptedMerchantAddress = event.params._order.acceptedMerchant;
  order.merchant = merchant.id;
  order.acceptedAt = event.block.timestamp;
  order.save();

  // SET ORDERS IN MERCHANT ENTITY
  let merchantOrders = merchant.orders;
  if (merchantOrders == null) {
    merchantOrders = [];
  }
  merchantOrders.push(order.id);
  merchant.orders = merchantOrders;
  if (merchant.startedAt.equals(BigInt.zero())) {
    merchant.startedAt = event.block.timestamp;
  }
  merchant.save();
}

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
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toHexString()),
    event
  );

  // merchant.circle is already Bytes - no conversion needed
  const circle = merchant.circle;

  // Check if circle is the default placeholder value (Bytes.fromI32(0))
  if (!circle || circle.equals(Bytes.fromI32(0))) return;

  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

  circleMetrics.totalVolume = circleMetrics.totalVolume.plus(
    event.params._order.amount
  );

  circleMetrics.save();
}

export function handleOrderCancelledBy(event: OrderCancelledByEvent): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event
  );
  order.cancelledBy = event.params.cancelledBy;
  order.save();
}

export function handleAdditionalOrderDetails(event: AdditionalOrderDetailsEvent): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event
  );
  order.fixedFeePaid = event.params.details.fixedFeePaid;
  order.tipsPaid = event.params.details.tipsPaid;
  order.actualUsdcAmount = event.params.details.actualUsdtAmount;
  order.actualFiatAmount = event.params.details.actualFiatAmount;
  order.save();
}

export function handleDisputeTransIdSet(event: DisputeTransIdSetEvent): void {
  // Synchronize order data with the latest contract state
  syncOrder(
    event.params.orderId,
    event.params._order.orderType,
    event.params._order.status,
    event.params._order.user,
    event.params._order.recipientAddr,
    event.params._order.amount,
    event.params._order.fiatAmount,
    event.params._order.currency,
    event.params._order.userCompleted,
    event.params._order.userCompletedTimestamp,
    event.params._order.placedTimestamp,
    event.params._order.completedTimestamp,
    event.params._order.pubkey,
    event.params._order.encUpi,
    event.params._order.userPubKey,
    event.params._order.encMerchantUpi,
    event.params._order.circleId,
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event
  );
  order.disputeSettledByAddr = event.params.by;
  order.save();
}