import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  OrderPlaced as LegacyOrderPlacedEvent,
  OrderAccepted as LegacyOrderAcceptedEvent,
  BuyOrderPaid as LegacyBuyOrderPaidEvent,
  SellOrderUpiSet as LegacySellOrderUpiSetEvent,
  OrderCompleted as LegacyOrderCompletedEvent,
  CancelledOrders as LegacyCancelledOrdersEvent,
  OrderCancelledBy as LegacyOrderCancelledByEvent,
  AdditionalOrderDetails as LegacyAdditionalOrderDetailsEvent,
} from "../generated/LegacyOrderFlowFacet/LegacyOrderFlowFacet";
import {
  OrderDispute1 as LegacyOrderDisputeEvent,
  OrderDispute as LegacyOrderDisputeV2Event,
} from "../generated/LegacyOrderProcessorFacet/LegacyOrderProcessorFacet";
import { loadOrders, syncOrder, loadUser, adjustUserMetricsByOrderType } from "./lib";
import {
  DISPUTE_STATUS_RAISED,
  DISPUTE_STATUS_SETTLED,
  ORDER_STATUS_COMPLETED,
  ORDER_STATUS_CANCELLED,
  ORDER_TYPE_BUY,
  ORDER_TYPE_SELL,
  ORDER_TYPE_PAY,
} from "./constants/status";

export function handleLegacyOrderPlaced(event: LegacyOrderPlacedEvent): void {
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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;
  order.save();
}

export function handleLegacyOrderAccepted(
  event: LegacyOrderAcceptedEvent,
): void {
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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;
  order.acceptedPCId = event.params._order.acceptedAccountNo;
  order.acceptedMerchantAddress = event.params._order.acceptedMerchant;
  order.acceptedAt = event.block.timestamp;
  order.save();
}

export function handleLegacyBuyOrderPaid(
  event: LegacyBuyOrderPaidEvent,
): void {
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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;
  order.paidAt = event.block.timestamp;
  order.save();
}

export function handleLegacySellOrderUpiSet(
  event: LegacySellOrderUpiSetEvent,
): void {
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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;
  order.paidAt = event.block.timestamp;
  order.save();
}

export function handleLegacyOrderCompleted(
  event: LegacyOrderCompletedEvent,
): void {
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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;
  order.save();

  // Update User metrics
  let user = loadUser(event.params._order.user, event);

  const orderType = event.params._order.orderType;
  if (orderType === ORDER_TYPE_BUY) {
    user.completedBuyOrdersCount = user.completedBuyOrdersCount.plus(
      BigInt.fromI32(1),
    );
  } else if (orderType === ORDER_TYPE_SELL) {
    user.completedSellOrdersCount = user.completedSellOrdersCount.plus(
      BigInt.fromI32(1),
    );
  } else if (orderType === ORDER_TYPE_PAY) {
    user.completedPayOrdersCount = user.completedPayOrdersCount.plus(
      BigInt.fromI32(1),
    );
  }

  if (user.firstOrderCompletedAt.equals(BigInt.zero())) {
    user.firstOrderCompletedAt = event.block.timestamp;
    user.firstOrderCompletedCurrency = event.params._order.currency;
  }

  user.recentOrderCompletedAt = event.block.timestamp;
  user.recentOrderCompletedCurrency = event.params._order.currency;
  user.totalVolume = user.totalVolume.plus(event.params._order.amount);

  user.save();
}

export function handleLegacyCancelledOrders(
  event: LegacyCancelledOrdersEvent,
): void {
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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;
  order.save();

  // Update User cancelled counts
  let user = loadUser(event.params._order.user, event);

  const orderType = event.params._order.orderType;
  if (orderType === ORDER_TYPE_BUY) {
    user.cancelledBuyOrdersCount = user.cancelledBuyOrdersCount.plus(
      BigInt.fromI32(1),
    );
  } else if (orderType === ORDER_TYPE_SELL) {
    user.cancelledSellOrdersCount = user.cancelledSellOrdersCount.plus(
      BigInt.fromI32(1),
    );
  } else if (orderType === ORDER_TYPE_PAY) {
    user.cancelledPayOrdersCount = user.cancelledPayOrdersCount.plus(
      BigInt.fromI32(1),
    );
  }

  user.save();
}

export function handleLegacyOrderCancelledBy(
  event: LegacyOrderCancelledByEvent,
): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
  );
  order.cancelledBy = event.params.cancelledBy;
  order.cancelledAt = event.block.timestamp;
  order.save();
}

export function handleLegacyAdditionalOrderDetails(
  event: LegacyAdditionalOrderDetailsEvent,
): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
  );
  order.fixedFeePaid = event.params.details.fixedFeePaid;
  order.tipsPaid = event.params.details.tipsPaid;
  order.actualUsdcAmount = event.params.details.actualUsdtAmount;
  order.actualFiatAmount = event.params.details.actualFiatAmount;
  order.save();
}

export function handleLegacyOrderDispute(
  event: LegacyOrderDisputeEvent,
): void {
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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;

  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_RAISED) {
    order.disputePlacedAt = event.block.timestamp;
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
    order.disputeSettledAt = event.block.timestamp;
    order.disputeSettledByAddr = event.transaction.from;
  }

  order.save();
}

export function handleLegacyOrderDisputeV2(
  event: LegacyOrderDisputeV2Event,
): void {
  // Load order BEFORE syncOrder to capture previous status
  let orderBeforeSync = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  const previousStatus = orderBeforeSync.status;

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
    BigInt.fromI32(0),
    event.params._order.disputeInfo.status,
    event.params._order.disputeInfo.redactTransId,
    event.params._order.disputeInfo.accountNumber,
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.isLegacyOrder = true;
  order.disputeFaultType = event.params.faultType;

  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_RAISED) {
    order.disputePlacedAt = event.block.timestamp;
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
    order.disputeSettledAt = event.block.timestamp;
    order.disputeSettledByAddr = event.transaction.from;
  }

  order.save();

  // Adjust User metrics when dispute is settled
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED) {
    const newStatus = event.params._order.status;
    const user = loadUser(event.params._order.user, event);
    const orderType = event.params._order.orderType;

    if (
      previousStatus === ORDER_STATUS_COMPLETED &&
      newStatus === ORDER_STATUS_CANCELLED
    ) {
      adjustUserMetricsByOrderType(
        user,
        orderType,
        BigInt.fromI32(-1),
        BigInt.fromI32(1),
      );
      user.totalVolume = user.totalVolume.minus(event.params._order.amount);
    } else if (
      previousStatus === ORDER_STATUS_CANCELLED &&
      newStatus === ORDER_STATUS_COMPLETED
    ) {
      adjustUserMetricsByOrderType(
        user,
        orderType,
        BigInt.fromI32(1),
        BigInt.fromI32(-1),
      );
      user.totalVolume = user.totalVolume.plus(event.params._order.amount);
    } else if (
      previousStatus !== ORDER_STATUS_COMPLETED &&
      previousStatus !== ORDER_STATUS_CANCELLED
    ) {
      if (newStatus === ORDER_STATUS_COMPLETED) {
        adjustUserMetricsByOrderType(
          user,
          orderType,
          BigInt.fromI32(1),
          BigInt.fromI32(0),
        );
        user.totalVolume = user.totalVolume.plus(event.params._order.amount);
      } else if (newStatus === ORDER_STATUS_CANCELLED) {
        adjustUserMetricsByOrderType(
          user,
          orderType,
          BigInt.fromI32(0),
          BigInt.fromI32(1),
        );
      }
    }

    user.save();
  }
}
