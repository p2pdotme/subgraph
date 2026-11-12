import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
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
import { loadOrders, syncOrder, loadUser, adjustUserMetricsByOrderType, loadLegacyStats, updateCurrencyMetrics } from "./lib";
import {
  loadCampaign,
  loadCampaignManagers,
  loadCampaignRewardRedeemed,
} from "./lib/campaign.lib";
import {
  DISPUTE_STATUS_RAISED,
  DISPUTE_STATUS_SETTLED,
  ORDER_STATUS_COMPLETED,
  ORDER_STATUS_CANCELLED,
  ORDER_TYPE_BUY,
  ORDER_TYPE_SELL,
  ORDER_TYPE_PAY,
  FAULT_TYPE_USER,
} from "./constants/status";
import { getYearMonthFromTimestamp } from "./utils/date.utils";
import { nonNegative } from "./utils/math.utils";

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

  // UPDATE CAMPAIGN VOLUME
  let campaignClaims = user.campaignClaims;
  if (campaignClaims !== null && campaignClaims.length > 0) {
    for (let i = 0; i < campaignClaims.length; i++) {
      let campaignClaim = loadCampaignRewardRedeemed(campaignClaims[i], event);
      if (campaignClaim !== null) {
        let campaign = loadCampaign(
          Bytes.fromByteArray(Bytes.fromBigInt(campaignClaim.campaignId)),
          event,
        );
        campaign.totalVolume = campaign.totalVolume.plus(
          event.params._order.amount,
        );
        campaign.save();

        let campaignManagersKey = Bytes.fromUTF8(
          campaignClaim.campaignId.toString() +
            "-" +
            campaignClaim.manager.toHex(),
        );
        let campaignManagers = loadCampaignManagers(campaignManagersKey, event);
        campaignManagers.totalVolume = campaignManagers.totalVolume.plus(
          event.params._order.amount,
        );
        campaignManagers.save();
      }
    }
  }

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

  // Update currency metrics (monthly + daily)
  updateCurrencyMetrics(
    event.params._order.currency,
    orderType,
    BigInt.fromI32(1),
    BigInt.fromI32(0),
    event.params._order.amount,
    event.block.timestamp,
    event,
  );

  // Update legacy stats
  const legacyStats = loadLegacyStats(event.params._order.currency, event);
  legacyStats.currency = event.params._order.currency;
  legacyStats.completedOrdersCount = legacyStats.completedOrdersCount.plus(BigInt.fromI32(1));
  legacyStats.totalVolume = legacyStats.totalVolume.plus(event.params._order.amount);
  legacyStats.save();
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

  // Update currency metrics (monthly + daily)
  updateCurrencyMetrics(
    event.params._order.currency,
    orderType,
    BigInt.fromI32(0),
    BigInt.fromI32(1),
    BigInt.fromI32(0),
    event.block.timestamp,
    event,
  );

  // Update legacy stats
  const legacyStats = loadLegacyStats(event.params._order.currency, event);
  legacyStats.currency = event.params._order.currency;
  legacyStats.cancelledOrdersCount = legacyStats.cancelledOrdersCount.plus(BigInt.fromI32(1));
  legacyStats.save();
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

  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_RAISED) {
    order.disputePlacedAt = event.block.timestamp;

    // Update legacy stats dispute count
    const legacyStats = loadLegacyStats(event.params._order.currency, event);
    legacyStats.currency = event.params._order.currency;
    legacyStats.disputeCount = legacyStats.disputeCount.plus(BigInt.fromI32(1));
    legacyStats.save();
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
    order.disputeSettledAt = event.block.timestamp;
    order.disputeSettledByAddr = event.transaction.from;
  }

  order.save();

  // Adjust user, currency metrics and legacy stats on dispute settlement.
  // The pre-faultType event carries no fault: only the timestamps decide.
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED) {
    applyLegacySettlement(
      event,
      event.params._order.id,
      event.params._order.user,
      event.params._order.currency,
      event.params._order.orderType,
      event.params._order.status,
      event.params._order.amount,
      previousStatus,
      true,
    );
  }
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

    // Update legacy stats dispute count
    const legacyStats = loadLegacyStats(event.params._order.currency, event);
    legacyStats.currency = event.params._order.currency;
    legacyStats.disputeCount = legacyStats.disputeCount.plus(BigInt.fromI32(1));
    legacyStats.save();
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
    order.disputeSettledAt = event.block.timestamp;
    order.disputeSettledByAddr = event.transaction.from;
  }

  order.save();

  // Adjust user, currency metrics and legacy stats on dispute settlement.
  // A user-fault settlement calls neither completeOrder nor cancelOrder.
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED) {
    applyLegacySettlement(
      event,
      event.params._order.id,
      event.params._order.user,
      event.params._order.currency,
      event.params._order.orderType,
      event.params._order.status,
      event.params._order.amount,
      previousStatus,
      event.params.faultType !== FAULT_TYPE_USER,
    );
  }
}

// adminSettleDispute has always called completeOrder/cancelOrder before it
// emits OrderDispute (pre-COT too: adminSettleDispute(orderId, bool userFault)
// at contracts-v4 88c71f0^), so handleLegacyCancelledOrders /
// handleLegacyOrderCompleted have already synced and counted the new status
// and previousStatus equals newStatus here. Read the status a settlement
// overturned from the order's own timestamps, as
// handleOrderDisputeWithFaultType does: the old status comes off, and the new
// one is added only if its own log was never indexed.
function applyLegacySettlement(
  event: ethereum.Event,
  orderId: BigInt,
  userAddress: Address,
  currency: Bytes,
  orderType: i32,
  newStatus: i32,
  amount: BigInt,
  previousStatus: i32,
  orderMoved: boolean,
): void {
  const disputedOrder = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(orderId)),
    event,
  );
  const overturnedCompleted =
    orderMoved &&
    newStatus === ORDER_STATUS_CANCELLED &&
    disputedOrder.completedAt.gt(BigInt.zero());
  const overturnedCancelled =
    orderMoved &&
    newStatus === ORDER_STATUS_COMPLETED &&
    disputedOrder.cancelledAt.gt(BigInt.zero());
  const newStatusCounted = previousStatus === newStatus;
  const addNew = newStatusCounted ? BigInt.fromI32(0) : BigInt.fromI32(1);

  // Bucket the reversal in the month the overturned status was counted
  let originalTimestamp: BigInt;
  if (overturnedCompleted) {
    originalTimestamp = disputedOrder.completedAt;
  } else if (overturnedCancelled) {
    originalTimestamp = disputedOrder.cancelledAt;
  } else {
    originalTimestamp = event.block.timestamp;
  }

  const user = loadUser(userAddress, event);
  const legacyStats = loadLegacyStats(currency, event);
  legacyStats.currency = currency;

  if (overturnedCompleted) {
    // COMPLETED → CANCELLED
    adjustUserMetricsByOrderType(user, orderType, BigInt.fromI32(-1), addNew);
    user.totalVolume = nonNegative(user.totalVolume.minus(amount));
    updateCurrencyMetrics(currency, orderType, BigInt.fromI32(-1), addNew, BigInt.fromI32(0).minus(amount), originalTimestamp, event);
    legacyStats.completedOrdersCount = nonNegative(legacyStats.completedOrdersCount.minus(BigInt.fromI32(1)));
    legacyStats.cancelledOrdersCount = legacyStats.cancelledOrdersCount.plus(addNew);
    legacyStats.totalVolume = nonNegative(legacyStats.totalVolume.minus(amount));
  } else if (overturnedCancelled) {
    // CANCELLED → COMPLETED
    const addVolume = newStatusCounted ? BigInt.fromI32(0) : amount;
    adjustUserMetricsByOrderType(user, orderType, addNew, BigInt.fromI32(-1));
    user.totalVolume = user.totalVolume.plus(addVolume);
    updateCurrencyMetrics(currency, orderType, addNew, BigInt.fromI32(-1), addVolume, originalTimestamp, event);
    legacyStats.cancelledOrdersCount = nonNegative(legacyStats.cancelledOrdersCount.minus(BigInt.fromI32(1)));
    legacyStats.completedOrdersCount = legacyStats.completedOrdersCount.plus(addNew);
    legacyStats.totalVolume = legacyStats.totalVolume.plus(addVolume);
  } else if (
    previousStatus !== ORDER_STATUS_COMPLETED &&
    previousStatus !== ORDER_STATUS_CANCELLED
  ) {
    // fresh → terminal: the cancel/complete log itself was never indexed
    if (newStatus === ORDER_STATUS_COMPLETED) {
      adjustUserMetricsByOrderType(user, orderType, BigInt.fromI32(1), BigInt.fromI32(0));
      user.totalVolume = user.totalVolume.plus(amount);
      updateCurrencyMetrics(currency, orderType, BigInt.fromI32(1), BigInt.fromI32(0), amount, originalTimestamp, event);
      legacyStats.completedOrdersCount = legacyStats.completedOrdersCount.plus(BigInt.fromI32(1));
      legacyStats.totalVolume = legacyStats.totalVolume.plus(amount);
    } else if (newStatus === ORDER_STATUS_CANCELLED) {
      adjustUserMetricsByOrderType(user, orderType, BigInt.fromI32(0), BigInt.fromI32(1));
      updateCurrencyMetrics(currency, orderType, BigInt.fromI32(0), BigInt.fromI32(1), BigInt.fromI32(0), originalTimestamp, event);
      legacyStats.cancelledOrdersCount = legacyStats.cancelledOrdersCount.plus(BigInt.fromI32(1));
    }
  }

  legacyStats.save();
  user.save();
}
