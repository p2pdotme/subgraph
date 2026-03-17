import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  OrderCompleted as OrderCompletedEvent,
  BuyOrderPaid as BuyOrderPaidEvent,
  OrderAccepted as OrderAcceptedEvent,
  AdditionalOrderDetails as AdditionalOrderDetailsEvent,
} from "../generated/OrderFlowHelper/OrderFlowHelper";
import {
  OrderDispute as OrderDisputeWithFaultTypeEvent,
  CircleStatusUpdated as CircleStatusUpdatedEvent,
} from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import {
  loadAssignedMerchants,
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadCircleScoreState,
  loadCircleDailyMetrics,
  getDayNumber,
  getDailyMetricsKey,
  loadCircleOrderMetricsByMonth,
  loadOrders,
  loadMerchantOrderMetricsByMonth,
  updateCurrencyMetrics,
  syncOrder,
  loadUser,
  adjustUserMetricsByOrderType,
  updateCircleScore,
  updateSettlementTime,
  compute30dMetrics,
  applyTrustFirewall,
  checkBootstrapGraduation,
} from "./lib";
import {
  CircleMetrics,
  CircleOrderMetricsByMonth,
  CircleScoreState,
  MerchantOrderMetricsByMonth,
  User,
} from "../generated/schema";
import {
  DISPUTE_STATUS_RAISED,
  DISPUTE_STATUS_SETTLED,
  ORDER_STATUS_COMPLETED,
  ORDER_STATUS_CANCELLED,
  ORDER_TYPE_BUY,
  ORDER_TYPE_SELL,
  ORDER_TYPE_PAY,
} from "./constants/status";
import {
  CancelledOrders as CancelledOrdersEvent,
  OrderPlaced as OrderPlacedEvent,
  SellOrderUpiSet as SellOrderUpiSetEvent,
  MerchantAssignedNewOrder as MerchantAssignedNewOrderEvent,
  MerchantReAssignedNewOrder as MerchantReAssignedNewOrderEvent,
  OrderCancelledBy as OrderCancelledByEvent,
} from "../generated/OrderFlowFacet/OrderFlowFacet";
import { getYearMonthFromTimestamp } from "./utils/date.utils";
import {
  loadCampaign,
  loadCampaignManagers,
  loadCampaignRewardRedeemed,
} from "./lib/campaign.lib";


function adjustMerchantMetricsByOrderType(
  metrics: MerchantOrderMetricsByMonth,
  orderType: i32,
  completedDelta: BigInt,
  cancelledDelta: BigInt,
): void {
  if (orderType === ORDER_TYPE_BUY) {
    metrics.completedBuyOrdersCount =
      metrics.completedBuyOrdersCount.plus(completedDelta);
    metrics.cancelledBuyOrdersCount =
      metrics.cancelledBuyOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_SELL) {
    metrics.completedSellOrdersCount =
      metrics.completedSellOrdersCount.plus(completedDelta);
    metrics.cancelledSellOrdersCount =
      metrics.cancelledSellOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_PAY) {
    metrics.completedPayOrdersCount =
      metrics.completedPayOrdersCount.plus(completedDelta);
    metrics.cancelledPayOrdersCount =
      metrics.cancelledPayOrdersCount.plus(cancelledDelta);
  }
}

function adjustCircleMetricsByOrderType(
  metrics: CircleOrderMetricsByMonth,
  orderType: i32,
  completedDelta: BigInt,
  cancelledDelta: BigInt,
): void {
  if (orderType === ORDER_TYPE_BUY) {
    metrics.completedBuyOrdersCount =
      metrics.completedBuyOrdersCount.plus(completedDelta);
    metrics.cancelledBuyOrdersCount =
      metrics.cancelledBuyOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_SELL) {
    metrics.completedSellOrdersCount =
      metrics.completedSellOrdersCount.plus(completedDelta);
    metrics.cancelledSellOrdersCount =
      metrics.cancelledSellOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_PAY) {
    metrics.completedPayOrdersCount =
      metrics.completedPayOrdersCount.plus(completedDelta);
    metrics.cancelledPayOrdersCount =
      metrics.cancelledPayOrdersCount.plus(cancelledDelta);
  }
}


export function handleOrderDisputeWithFaultType(
  event: OrderDisputeWithFaultTypeEvent,
): void {
  // Load order BEFORE syncOrder to capture previous status
  let orderBeforeSync = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  const previousStatus = orderBeforeSync.status;

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
    event,
  );

  // Set disputePlacedAt when dispute is raised, disputeSettledAt when settled
  // Also set disputeFaultType from the event
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_RAISED) {
    let _order = loadOrders(
      Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
      event,
    );
    _order.disputePlacedAt = event.block.timestamp;
    _order.disputeFaultType = event.params.faultType;
    _order.save();
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
    let _order = loadOrders(
      Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
      event,
    );
    _order.disputeSettledAt = event.block.timestamp;
    _order.disputeFaultType = event.params.faultType;
    _order.disputeSettledByAddr = event.transaction.from;
    _order.save();
  }

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toHexString()),
    event,
  );

  // merchant.circle is already Bytes - no conversion needed
  const circle = merchant.circle;

  // Check if circle is the default placeholder value (Bytes.fromI32(0))
  if (!circle || circle.equals(Bytes.fromI32(0))) return;

  const newStatus = event.params._order.status;

  // Update metrics when dispute is settled
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED) {
    // Load the order to get original timestamps for correct month bucket
    const disputedOrder = loadOrders(
      Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
      event,
    );

    // Use the original event's timestamp to target the correct month bucket:
    // - COMPLETED → CANCELLED: use completedAt (month where completion was recorded)
    // - CANCELLED → COMPLETED: use cancelledAt (month where cancellation was recorded)
    // - fresh: use current block timestamp
    let originalTimestamp: BigInt;
    if (previousStatus === ORDER_STATUS_COMPLETED) {
      originalTimestamp = disputedOrder.completedAt;
    } else if (previousStatus === ORDER_STATUS_CANCELLED) {
      originalTimestamp = disputedOrder.cancelledAt;
    } else {
      originalTimestamp = event.block.timestamp;
    }
    const month = getYearMonthFromTimestamp(originalTimestamp);

    // Update merchant monthly order metrics
    const merchantMetricsKey = Bytes.fromUTF8(
      `${merchant.id.toHexString()}-${month}`,
    );
    const orderMetrics = loadMerchantOrderMetricsByMonth(
      merchantMetricsKey,
      event,
    );
    orderMetrics.merchant = merchant.id;
    orderMetrics.month = month;

    // Update circle monthly order metrics
    const circleMetricsKey = Bytes.fromUTF8(`${circle.toHexString()}-${month}`);
    const circleOrderMetrics = loadCircleOrderMetricsByMonth(
      circleMetricsKey,
      event,
    );
    circleOrderMetrics.circle = circle;
    circleOrderMetrics.month = month;

    const user = loadUser(event.params._order.user, event);

    const orderType = event.params._order.orderType;

    // Adjust counts based on status change
    if (
      previousStatus === ORDER_STATUS_COMPLETED &&
      newStatus === ORDER_STATUS_CANCELLED
    ) {
      // COMPLETED → CANCELLED: decrement completed, increment cancelled
      adjustMerchantMetricsByOrderType(orderMetrics, orderType, BigInt.fromI32(-1), BigInt.fromI32(1));
      adjustUserMetricsByOrderType(user, orderType, BigInt.fromI32(-1), BigInt.fromI32(1));
      adjustCircleMetricsByOrderType(circleOrderMetrics, orderType, BigInt.fromI32(-1), BigInt.fromI32(1));
      user.totalVolume = user.totalVolume.minus(event.params._order.amount);
    } else if (
      previousStatus === ORDER_STATUS_CANCELLED &&
      newStatus === ORDER_STATUS_COMPLETED
    ) {
      // CANCELLED → COMPLETED: increment completed, decrement cancelled
      adjustMerchantMetricsByOrderType(orderMetrics, orderType, BigInt.fromI32(1), BigInt.fromI32(-1));
      adjustUserMetricsByOrderType(user, orderType, BigInt.fromI32(1), BigInt.fromI32(-1));
      adjustCircleMetricsByOrderType(circleOrderMetrics, orderType, BigInt.fromI32(1), BigInt.fromI32(-1));
      user.totalVolume = user.totalVolume.plus(event.params._order.amount);
    } else if (
      previousStatus !== ORDER_STATUS_COMPLETED &&
      previousStatus !== ORDER_STATUS_CANCELLED
    ) {
      if (newStatus === ORDER_STATUS_COMPLETED) {
        // fresh → COMPLETED
        adjustMerchantMetricsByOrderType(orderMetrics, orderType, BigInt.fromI32(1), BigInt.fromI32(0));
        adjustUserMetricsByOrderType(user, orderType, BigInt.fromI32(1), BigInt.fromI32(0));
        adjustCircleMetricsByOrderType(circleOrderMetrics, orderType, BigInt.fromI32(1), BigInt.fromI32(0));
        user.totalVolume = user.totalVolume.plus(event.params._order.amount);
      } else if (newStatus === ORDER_STATUS_CANCELLED) {
        // fresh → CANCELLED
        adjustMerchantMetricsByOrderType(orderMetrics, orderType, BigInt.fromI32(0), BigInt.fromI32(1));
        adjustUserMetricsByOrderType(user, orderType, BigInt.fromI32(0), BigInt.fromI32(1));
        adjustCircleMetricsByOrderType(circleOrderMetrics, orderType, BigInt.fromI32(0), BigInt.fromI32(1));
      }
    }
    // Update currency metrics (monthly + daily)
    if (
      previousStatus === ORDER_STATUS_COMPLETED &&
      newStatus === ORDER_STATUS_CANCELLED
    ) {
      updateCurrencyMetrics(event.params._order.currency, orderType, BigInt.fromI32(-1), BigInt.fromI32(1), BigInt.fromI32(0).minus(event.params._order.amount), originalTimestamp, event);
    } else if (
      previousStatus === ORDER_STATUS_CANCELLED &&
      newStatus === ORDER_STATUS_COMPLETED
    ) {
      updateCurrencyMetrics(event.params._order.currency, orderType, BigInt.fromI32(1), BigInt.fromI32(-1), event.params._order.amount, originalTimestamp, event);
    } else if (
      previousStatus !== ORDER_STATUS_COMPLETED &&
      previousStatus !== ORDER_STATUS_CANCELLED
    ) {
      if (newStatus === ORDER_STATUS_COMPLETED) {
        updateCurrencyMetrics(event.params._order.currency, orderType, BigInt.fromI32(1), BigInt.fromI32(0), event.params._order.amount, originalTimestamp, event);
      } else if (newStatus === ORDER_STATUS_CANCELLED) {
        updateCurrencyMetrics(event.params._order.currency, orderType, BigInt.fromI32(0), BigInt.fromI32(1), BigInt.fromI32(0), originalTimestamp, event);
      }
    }

    user.save();
    orderMetrics.save();
    circleOrderMetrics.save();
  }

  // Update dispute metrics (raised/resolved counts)
  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

  let scoreState = loadCircleScoreState(circle, event);

  // updateDisputeMetrics expects OrderDisputeEvent but the logic only uses
  // disputeInfo.status which is the same field, so we cast safely
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_RAISED) {
    circleMetrics.raisedDisputesCount = circleMetrics.raisedDisputesCount.plus(
      BigInt.fromI32(1),
    );
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
    circleMetrics.raisedDisputesCount = circleMetrics.raisedDisputesCount.minus(
      BigInt.fromI32(1),
    );
    circleMetrics.resolvedDisputesCount =
      circleMetrics.resolvedDisputesCount.plus(BigInt.fromI32(1));
  }

  // UPDATE CIRCLE SCORE WHEN DISPUTE IS SETTLED
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED) {
    const newStatus = event.params._order.status;

    if (
      newStatus === ORDER_STATUS_CANCELLED &&
      previousStatus === ORDER_STATUS_COMPLETED
    ) {
      scoreState.merchantFaultDisputesCount =
        scoreState.merchantFaultDisputesCount.plus(BigInt.fromI32(1));

      // Reverse settlement metrics for the disputed order using actual values
      const order = loadOrders(
        Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
        event,
      );

      // Use the original completion day's bucket (not settlement day) so that
      // dispute rate stays consistent with completed order counts in the
      // 30-day rolling window
      const completedDayNum = getDayNumber(order.completedAt);
      const completedDailyKey = getDailyMetricsKey(circle, completedDayNum);
      let completedDaily = loadCircleDailyMetrics(completedDailyKey, event);
      completedDaily.circle = circle;
      completedDaily.dayNumber = BigInt.fromI32(completedDayNum);
      completedDaily.merchantFaultDisputesCount = completedDaily.merchantFaultDisputesCount.plus(
        BigInt.fromI32(1),
      );

      if (
        (order.type === ORDER_TYPE_SELL || order.type === ORDER_TYPE_PAY) &&
        order.paidAt.gt(BigInt.zero()) &&
        order.completedAt.gt(BigInt.zero()) &&
        order.completedAt.ge(order.paidAt)
      ) {
        const actualSettlementSeconds = order.completedAt.minus(order.paidAt);

        if (completedDaily.completedOrdersCount.gt(BigInt.zero())) {
          completedDaily.settlementSecondsSum =
            completedDaily.settlementSecondsSum.minus(actualSettlementSeconds);
          completedDaily.completedOrdersCount =
            completedDaily.completedOrdersCount.minus(BigInt.fromI32(1));
        }

        // Reverse cumulative settlement metrics
        if (scoreState.completedSellPayOrders.gt(BigInt.zero())) {
          scoreState.completedSellPayOrders =
            scoreState.completedSellPayOrders.minus(BigInt.fromI32(1));

          if (scoreState.completedSellPayOrders.gt(BigInt.zero())) {
            scoreState.cumulativeSettlementSeconds =
              scoreState.cumulativeSettlementSeconds.minus(
                actualSettlementSeconds,
              );
          } else {
            scoreState.cumulativeSettlementSeconds = BigInt.zero();
          }
        }
      }
      completedDaily.save();
    }

    compute30dMetrics(scoreState, event.block.timestamp);
    updateCircleScore(circleMetrics, scoreState);

    applyTrustFirewall(circleMetrics, scoreState);

    circleMetrics.lastScoreUpdateTimestamp = event.block.timestamp;
  }

  circleMetrics.save();
  scoreState.save();
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
    event,
  );

  // Only update merchant stats if an order was accepted by a merchant
  const acceptedMerchantAddress = event.params._order.acceptedMerchant;
  if (!acceptedMerchantAddress.equals(Bytes.empty())) {
    const merchant = loadCircleMerchant(
      Bytes.fromHexString(acceptedMerchantAddress.toHexString()),
      event,
    );

    // merchant.circle is already Bytes - no conversion needed
    const circle = merchant.circle;

    // Check if circle is the default placeholder value (Bytes.fromI32(0))
    if (!circle || circle.equals(Bytes.fromI32(0))) return;

    // Update monthly order metrics
    const month = getYearMonthFromTimestamp(event.block.timestamp);

    // Update merchant monthly order metrics
    const merchantMetricsKey = Bytes.fromUTF8(
      `${merchant.id.toHexString()}-${month}`,
    );
    const orderMetrics = loadMerchantOrderMetricsByMonth(
      merchantMetricsKey,
      event,
    );
    orderMetrics.merchant = merchant.id;
    orderMetrics.month = month;

    let user = loadUser(event.params._order.user, event);

    const orderType = event.params._order.orderType;

    // UPDATE CANCELLED ORDERS COUNT
    if (orderType === ORDER_TYPE_BUY) {
      orderMetrics.cancelledBuyOrdersCount =
        orderMetrics.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));

      user.cancelledBuyOrdersCount = user.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));
    } else if (orderType === ORDER_TYPE_SELL) {
      orderMetrics.cancelledSellOrdersCount =
        orderMetrics.cancelledSellOrdersCount.plus(BigInt.fromI32(1));

      user.cancelledSellOrdersCount = user.cancelledSellOrdersCount.plus(BigInt.fromI32(1));
    } else if (orderType === ORDER_TYPE_PAY) {
      orderMetrics.cancelledPayOrdersCount =
        orderMetrics.cancelledPayOrdersCount.plus(BigInt.fromI32(1));

      user.cancelledPayOrdersCount = user.cancelledPayOrdersCount.plus(BigInt.fromI32(1));
    }

    user.save();
    orderMetrics.save();

    // Update circle monthly order metrics
    const circleMetricsKey = Bytes.fromUTF8(`${circle.toHexString()}-${month}`);
    const circleOrderMetrics = loadCircleOrderMetricsByMonth(
      circleMetricsKey,
      event,
    );
    circleOrderMetrics.circle = circle;
    circleOrderMetrics.month = month;
    if (orderType === ORDER_TYPE_BUY) {
      circleOrderMetrics.cancelledBuyOrdersCount =
        circleOrderMetrics.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));
    } else if (orderType === ORDER_TYPE_SELL) {
      circleOrderMetrics.cancelledSellOrdersCount =
        circleOrderMetrics.cancelledSellOrdersCount.plus(BigInt.fromI32(1));
    } else if (orderType === ORDER_TYPE_PAY) {
      circleOrderMetrics.cancelledPayOrdersCount =
        circleOrderMetrics.cancelledPayOrdersCount.plus(BigInt.fromI32(1));
    }
    circleOrderMetrics.save();
  }

  // Update currency metrics (monthly + daily, regardless of merchant assignment)
  updateCurrencyMetrics(
    event.params._order.currency,
    event.params._order.orderType,
    BigInt.fromI32(0),
    BigInt.fromI32(1),
    BigInt.fromI32(0),
    event.block.timestamp,
    event,
  );
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
    event,
  );

  const circle = loadCircle(
    changetype<Bytes>(Bytes.fromBigInt(event.params._order.circleId)),
    event,
  );

  if (!circle) return;

  let circleMetrics = loadCircleMetrics(circle.id, event);

  if (!circleMetrics) return;

  circleMetrics.circle = circle.id;
  circleMetrics.totalPlacedOrdersCount =
    circleMetrics.totalPlacedOrdersCount.plus(BigInt.fromI32(1));

  circleMetrics.save();
}

export function handleMerchantAssignedNewOrder(
  event: MerchantAssignedNewOrderEvent,
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
    event,
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  const assignedMerchantKey = Bytes.fromUTF8(
    `${event.params.orderId.toString()}-${event.params.accountNo.toString()}-${event.params.merchant.toHexString()}`,
  );

  let assignedMerchant = loadAssignedMerchants(assignedMerchantKey, event);
  assignedMerchant.assignedMerchant = event.params.merchant.toHexString();
  assignedMerchant.merchant = merchant.id;
  assignedMerchant.orderId = event.params.orderId;
  assignedMerchant.assignedPCId = event.params.accountNo;
  assignedMerchant.save();

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
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
  event: MerchantReAssignedNewOrderEvent,
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
    event,
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  const assignedMerchantKey = Bytes.fromUTF8(
    `${event.params.orderId.toString()}-${event.params.accountNo.toString()}-${event.params.merchant.toHexString()}`,
  );
  let assignedMerchant = loadAssignedMerchants(assignedMerchantKey, event);
  assignedMerchant.assignedMerchant = event.params.merchant.toHexString();
  assignedMerchant.merchant = merchant.id;
  assignedMerchant.orderId = event.params.orderId;
  assignedMerchant.assignedPCId = event.params.accountNo;
  assignedMerchant.save();

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
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
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );
  order.paidAt = event.block.timestamp;
  order.save();
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
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
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
    event,
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toHexString()),
    event,
  );

  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
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

  // Increment lifetime accepted orders and daily bucket for circle score
  const circle = merchant.circle;
  if (circle && !circle.equals(Bytes.fromI32(0))) {
    let scoreState = loadCircleScoreState(circle, event);
    scoreState.lifetimeAcceptedOrders =
      scoreState.lifetimeAcceptedOrders.plus(BigInt.fromI32(1));
    scoreState.save();

    // Increment daily bucket accepted orders count (dispute rate denominator)
    const dayNum = getDayNumber(event.block.timestamp);
    const dailyKey = getDailyMetricsKey(circle, dayNum);
    let daily = loadCircleDailyMetrics(dailyKey, event);
    daily.circle = circle;
    daily.dayNumber = BigInt.fromI32(dayNum);
    daily.acceptedOrdersCount = daily.acceptedOrdersCount.plus(
      BigInt.fromI32(1),
    );
    daily.save();
  }
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
    event,
  );

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params._order.acceptedMerchant.toHexString()),
    event,
  );

  // merchant.circle is already Bytes - no conversion needed
  const circle = merchant.circle;

  // Check if circle is the default placeholder value (Bytes.fromI32(0))
  if (!circle || circle.equals(Bytes.fromI32(0))) return;

  // Update monthly order metrics
  const month = getYearMonthFromTimestamp(event.block.timestamp);

  // Update merchant monthly order metrics
  const merchantMetricsKey = Bytes.fromUTF8(
    `${merchant.id.toHexString()}-${month}`,
  );
  const orderMetrics = loadMerchantOrderMetricsByMonth(
    merchantMetricsKey,
    event,
  );
  orderMetrics.merchant = merchant.id;
  orderMetrics.month = month;

  // LOAD USER
  let user = loadUser(event.params._order.user, event);

  const orderType = event.params._order.orderType;

  // UPDATE COMPLETED ORDERS COUNT
  if (orderType === ORDER_TYPE_BUY) {
    orderMetrics.completedBuyOrdersCount =
      orderMetrics.completedBuyOrdersCount.plus(BigInt.fromI32(1));

    user.completedBuyOrdersCount = user.completedBuyOrdersCount.plus(
      BigInt.fromI32(1),
    );
  } else if (orderType === ORDER_TYPE_SELL) {
    orderMetrics.completedSellOrdersCount =
      orderMetrics.completedSellOrdersCount.plus(BigInt.fromI32(1));

    user.completedSellOrdersCount = user.completedSellOrdersCount.plus(
      BigInt.fromI32(1),
    );
  } else if (orderType === ORDER_TYPE_PAY) {
    orderMetrics.completedPayOrdersCount =
      orderMetrics.completedPayOrdersCount.plus(BigInt.fromI32(1));

    user.completedPayOrdersCount = user.completedPayOrdersCount.plus(
      BigInt.fromI32(1),
    );
  }

  orderMetrics.save();

  // Update circle monthly order metrics
  const circleMetricsKey = Bytes.fromUTF8(`${circle.toHexString()}-${month}`);
  const circleOrderMetrics = loadCircleOrderMetricsByMonth(
    circleMetricsKey,
    event,
  );
  circleOrderMetrics.circle = circle;
  circleOrderMetrics.month = month;
  if (orderType === ORDER_TYPE_BUY) {
    circleOrderMetrics.completedBuyOrdersCount =
      circleOrderMetrics.completedBuyOrdersCount.plus(BigInt.fromI32(1));
  } else if (orderType === ORDER_TYPE_SELL) {
    circleOrderMetrics.completedSellOrdersCount =
      circleOrderMetrics.completedSellOrdersCount.plus(BigInt.fromI32(1));
  } else if (orderType === ORDER_TYPE_PAY) {
    circleOrderMetrics.completedPayOrdersCount =
      circleOrderMetrics.completedPayOrdersCount.plus(BigInt.fromI32(1));
  }
  circleOrderMetrics.save();

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

  // Update circle volume metrics
  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

  circleMetrics.totalVolume = circleMetrics.totalVolume.plus(
    event.params._order.amount,
  );

  let scoreState = loadCircleScoreState(circle, event);

  // Load the order to check dispute status and timestamps
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
    event,
  );

  // UPDATE CIRCLE SCORE (only for non-disputed orders)
  if (order.disputeStatus === 0) {
    // No dispute
    const dayNum = getDayNumber(event.block.timestamp);
    const dailyKey = getDailyMetricsKey(circle, dayNum);
    let daily = loadCircleDailyMetrics(dailyKey, event);
    daily.circle = circle;
    daily.dayNumber = BigInt.fromI32(dayNum);

    // Add volume to daily bucket
    daily.volume = daily.volume.plus(event.params._order.amount);

    // Only calculate settlement time for SELL and PAY orders
    if (order.type === ORDER_TYPE_SELL || order.type === ORDER_TYPE_PAY) {
      // Validate timestamps exist
      if (
        order.paidAt.gt(BigInt.zero()) &&
        order.completedAt.gt(BigInt.zero())
      ) {
        // Calculate: completedAt - paidAt
        if (order.completedAt.ge(order.paidAt)) {
          const settlementSeconds = order.completedAt.minus(order.paidAt);
          updateSettlementTime(scoreState, settlementSeconds);

          // Write settlement time to daily bucket
          daily.settlementSecondsSum =
            daily.settlementSecondsSum.plus(settlementSeconds);
          daily.completedOrdersCount = daily.completedOrdersCount.plus(
            BigInt.fromI32(1),
          );
        }
      }
    }

    daily.save();

    // Recompute 30d rolling metrics
    compute30dMetrics(scoreState, event.block.timestamp);

    // Update circle score
    updateCircleScore(circleMetrics, scoreState);

    // Check lifecycle transitions
    checkBootstrapGraduation(circleMetrics, scoreState);
    applyTrustFirewall(circleMetrics, scoreState);

    // Update timestamp
    circleMetrics.lastScoreUpdateTimestamp = event.block.timestamp;
  }

  circleMetrics.save();
  scoreState.save();

  // UPDATE CAMPAIGN VOLUME
  let campaignClaims = user.campaignClaims;
  if (campaignClaims !== null && campaignClaims.length > 0) {
    for (let i = 0; i < campaignClaims.length; i++) {
      let campaignClaim = loadCampaignRewardRedeemed(campaignClaims[i], event);
      if (campaignClaim !== null) {
        // UPDATE CAMPAIGN VOLUME
        let campaign = loadCampaign(
          Bytes.fromByteArray(Bytes.fromBigInt(campaignClaim.campaignId)),
          event,
        );
        campaign.totalVolume = campaign.totalVolume.plus(
          event.params._order.amount,
        );
        campaign.save();

        // UPDATE CAMPAIGN MANAGERS VOLUME
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

  if (user.firstOrderCompletedAt.equals(BigInt.zero())) {
    user.firstOrderCompletedAt = event.block.timestamp;
    user.firstOrderCompletedCurrency = event.params._order.currency;
  }

  user.recentOrderCompletedAt = event.block.timestamp;
  user.recentOrderCompletedCurrency = event.params._order.currency;
  user.totalVolume = user.totalVolume.plus(event.params._order.amount);

  user.save();
}

export function handleOrderCancelledBy(event: OrderCancelledByEvent): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
  );
  order.cancelledBy = event.params.cancelledBy;
  order.cancelledAt = event.block.timestamp;
  order.save();
}

export function handleAdditionalOrderDetails(
  event: AdditionalOrderDetailsEvent,
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

// On-chain CircleStorage.CircleStatus enum: DEFAULT=0, ACTIVE=1, INACTIVE=2, REJECTED=3
const ONCHAIN_STATUS_DEFAULT: i32 = 0;
const ONCHAIN_STATUS_ACTIVE: i32 = 1;
const ONCHAIN_STATUS_INACTIVE: i32 = 2;
const ONCHAIN_STATUS_REJECTED: i32 = 3;

function applyActiveOrDefaultStatus(
  circleMetrics: CircleMetrics,
  scoreState: CircleScoreState,
): void {
  if (
    scoreState.lifetimeAcceptedOrders.ge(BigInt.fromI32(40)) ||
    circleMetrics.totalVolume.ge(BigInt.fromI64(20_000_000_000))
  ) {
    circleMetrics.circleStatus = "active";
  } else {
    circleMetrics.circleStatus = "bootstrap";
  }
  updateCircleScore(circleMetrics, scoreState);
  applyTrustFirewall(circleMetrics, scoreState);
}

export function handleCircleStatusUpdated(
  event: CircleStatusUpdatedEvent,
): void {
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  let circle = loadCircle(circleKey, event);
  let circleMetrics = loadCircleMetrics(circle.id, event);
  let scoreState = loadCircleScoreState(circle.id, event);

  if (event.params.newStatus == ONCHAIN_STATUS_REJECTED) {
    circleMetrics.circleStatus = "rejected";
    circleMetrics.circleScore = BigInt.zero();
  } else if (
    event.params.newStatus == ONCHAIN_STATUS_ACTIVE ||
    event.params.newStatus == ONCHAIN_STATUS_DEFAULT
  ) {
    applyActiveOrDefaultStatus(circleMetrics, scoreState);
  } else if (event.params.newStatus == ONCHAIN_STATUS_INACTIVE) {
    circleMetrics.circleStatus = "inactive";
    circleMetrics.circleScore = BigInt.zero();
  }

  circleMetrics.save();
  scoreState.save();
}
