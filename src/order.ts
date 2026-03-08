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
  loadCircleDailyMetrics,
  getDayNumber,
  getDailyMetricsKey,
  loadCircleOrderMetricsByMonth,
  loadOrders,
  loadMerchantOrderMetricsByMonth,
  syncOrder,
  loadUser,
  updateCircleScore,
  updateSettlementTime,
  compute30dMetrics,
  applyTrustFirewall,
  checkBootstrapGraduation,
} from "./lib";
import { CircleMetrics } from "../generated/schema";
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

/**
 * Updates the dispute metrics for a given circle metrics and event
 * @param circleMetrics - The circle metrics to update
 * @param event - The event to update the dispute metrics for
 */
const updateDisputeMetrics = (
  circleMetrics: CircleMetrics,
  event: OrderDisputeWithFaultTypeEvent,
): void => {
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
};

export function handleOrderDispute(
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
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_RAISED) {
    let _order = loadOrders(
      Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
      event,
    );
    _order.disputePlacedAt = event.block.timestamp;
    _order.save();
  } else if (
    event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED
  ) {
    let _order = loadOrders(
      Bytes.fromByteArray(Bytes.fromBigInt(event.params._order.id)),
      event,
    );
    _order.disputeSettledAt = event.block.timestamp;
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

    // Update circle monthly order metrics
    const circleMetricsKey = Bytes.fromUTF8(`${circle.toHexString()}-${month}`);
    const circleOrderMetrics = loadCircleOrderMetricsByMonth(
      circleMetricsKey,
      event,
    );
    circleOrderMetrics.circle = circle;
    circleOrderMetrics.month = month;

    const orderType = event.params._order.orderType;

    // Adjust counts based on status change
    // If previous status was COMPLETED and new status is CANCELLED: -1 completed, +1 cancelled
    // If previous status was CANCELLED and new status is COMPLETED: -1 cancelled, +1 completed
    if (
      previousStatus === ORDER_STATUS_COMPLETED &&
      newStatus === ORDER_STATUS_CANCELLED
    ) {
      // UPDATE COMPLETED ORDERS COUNT
      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.completedBuyOrdersCount =
          orderMetrics.completedBuyOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.completedSellOrdersCount =
          orderMetrics.completedSellOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.completedPayOrdersCount =
          orderMetrics.completedPayOrdersCount.minus(BigInt.fromI32(1));
      }

      // UPDATE CANCELLED ORDERS COUNT
      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.cancelledBuyOrdersCount =
          orderMetrics.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.cancelledSellOrdersCount =
          orderMetrics.cancelledSellOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.cancelledPayOrdersCount =
          orderMetrics.cancelledPayOrdersCount.plus(BigInt.fromI32(1));
      }

      circleOrderMetrics.totalCompletedOrdersCount =
        circleOrderMetrics.totalCompletedOrdersCount.minus(BigInt.fromI32(1));
      circleOrderMetrics.totalCancelledOrdersCount =
        circleOrderMetrics.totalCancelledOrdersCount.plus(BigInt.fromI32(1));
    } else if (
      previousStatus === ORDER_STATUS_CANCELLED &&
      newStatus === ORDER_STATUS_COMPLETED
    ) {
      // UPDATE CANCELLED ORDERS COUNT
      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.cancelledBuyOrdersCount =
          orderMetrics.cancelledBuyOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.cancelledSellOrdersCount =
          orderMetrics.cancelledSellOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.cancelledPayOrdersCount =
          orderMetrics.cancelledPayOrdersCount.minus(BigInt.fromI32(1));
      }

      // UPDATE COMPLETED ORDERS COUNT
      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.completedBuyOrdersCount =
          orderMetrics.completedBuyOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.completedSellOrdersCount =
          orderMetrics.completedSellOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.completedPayOrdersCount =
          orderMetrics.completedPayOrdersCount.plus(BigInt.fromI32(1));
      }

      circleOrderMetrics.totalCancelledOrdersCount =
        circleOrderMetrics.totalCancelledOrdersCount.minus(BigInt.fromI32(1));
      circleOrderMetrics.totalCompletedOrdersCount =
        circleOrderMetrics.totalCompletedOrdersCount.plus(BigInt.fromI32(1));
    } else if (
      previousStatus !== ORDER_STATUS_COMPLETED &&
      previousStatus !== ORDER_STATUS_CANCELLED
    ) {
      // Order wasn't counted before (was in dispute state), count it now based on final status
      if (newStatus === ORDER_STATUS_COMPLETED) {
        // UPDATE COMPLETED ORDERS COUNT
        if (orderType === ORDER_TYPE_BUY) {
          orderMetrics.completedBuyOrdersCount =
            orderMetrics.completedBuyOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_SELL) {
          orderMetrics.completedSellOrdersCount =
            orderMetrics.completedSellOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_PAY) {
          orderMetrics.completedPayOrdersCount =
            orderMetrics.completedPayOrdersCount.plus(BigInt.fromI32(1));
        }

        circleOrderMetrics.totalCompletedOrdersCount =
          circleOrderMetrics.totalCompletedOrdersCount.plus(BigInt.fromI32(1));
      } else if (newStatus === ORDER_STATUS_CANCELLED) {
        // UPDATE CANCELLED ORDERS COUNT
        if (orderType === ORDER_TYPE_BUY) {
          orderMetrics.cancelledBuyOrdersCount =
            orderMetrics.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_SELL) {
          orderMetrics.cancelledSellOrdersCount =
            orderMetrics.cancelledSellOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_PAY) {
          orderMetrics.cancelledPayOrdersCount =
            orderMetrics.cancelledPayOrdersCount.plus(BigInt.fromI32(1));
        }

        circleOrderMetrics.totalCancelledOrdersCount =
          circleOrderMetrics.totalCancelledOrdersCount.plus(BigInt.fromI32(1));
      }
    }
    orderMetrics.save();
    circleOrderMetrics.save();
  }

  // Update dispute metrics (raised/resolved counts)
  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

  updateDisputeMetrics(circleMetrics, event);

  // UPDATE CIRCLE SCORE WHEN DISPUTE IS SETTLED
  if (event.params._order.disputeInfo.status === DISPUTE_STATUS_SETTLED) {
    const newStatus = event.params._order.status;

    // Infer fault based on final order status:
    // - CANCELLED after dispute → merchant fault (order refunded)
    // - COMPLETED after dispute → user fault (order stayed completed)
    if (
      newStatus === ORDER_STATUS_CANCELLED &&
      previousStatus === ORDER_STATUS_COMPLETED
    ) {
      // Merchant at fault: order was completed but got cancelled
      circleMetrics.merchantFaultDisputesCount =
        circleMetrics.merchantFaultDisputesCount.plus(BigInt.fromI32(1));

      // Update today's daily bucket with dispute adjustment
      const dayNum = getDayNumber(event.block.timestamp);
      const dailyKey = getDailyMetricsKey(circle, dayNum);
      let daily = loadCircleDailyMetrics(dailyKey, event);
      daily.circle = circle;
      daily.dayNumber = BigInt.fromI32(dayNum);
      daily.merchantFaultDisputesCount = daily.merchantFaultDisputesCount.plus(
        BigInt.fromI32(1),
      );
      daily.save();

      // Decrement totalCompletedOrders (no longer completed)
      if (circleMetrics.totalCompletedOrders.gt(BigInt.zero())) {
        circleMetrics.totalCompletedOrders =
          circleMetrics.totalCompletedOrders.minus(BigInt.fromI32(1));

        // Adjust cumulative settlement time (estimate: remove average)
        if (circleMetrics.totalCompletedOrders.gt(BigInt.zero())) {
          circleMetrics.cumulativeSettlementSeconds =
            circleMetrics.cumulativeSettlementSeconds.minus(
              circleMetrics.avgSettlementSeconds,
            );

          circleMetrics.avgSettlementSeconds =
            circleMetrics.cumulativeSettlementSeconds.div(
              circleMetrics.totalCompletedOrders,
            );
        } else {
          circleMetrics.cumulativeSettlementSeconds = BigInt.zero();
          circleMetrics.avgSettlementSeconds = BigInt.zero();
        }
      }
    }

    // Recompute 30d rolling metrics and score
    compute30dMetrics(circleMetrics, event.block.timestamp);
    updateCircleScore(circleMetrics);

    // Apply trust firewall
    applyTrustFirewall(circleMetrics);

    circleMetrics.lastScoreUpdateTimestamp = event.block.timestamp;
  }

  circleMetrics.save();
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

    // Update circle monthly order metrics
    const circleMetricsKey = Bytes.fromUTF8(`${circle.toHexString()}-${month}`);
    const circleOrderMetrics = loadCircleOrderMetricsByMonth(
      circleMetricsKey,
      event,
    );
    circleOrderMetrics.circle = circle;
    circleOrderMetrics.month = month;

    const orderType = event.params._order.orderType;

    // Adjust counts based on status change
    if (
      previousStatus === ORDER_STATUS_COMPLETED &&
      newStatus === ORDER_STATUS_CANCELLED
    ) {
      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.completedBuyOrdersCount =
          orderMetrics.completedBuyOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.completedSellOrdersCount =
          orderMetrics.completedSellOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.completedPayOrdersCount =
          orderMetrics.completedPayOrdersCount.minus(BigInt.fromI32(1));
      }

      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.cancelledBuyOrdersCount =
          orderMetrics.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.cancelledSellOrdersCount =
          orderMetrics.cancelledSellOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.cancelledPayOrdersCount =
          orderMetrics.cancelledPayOrdersCount.plus(BigInt.fromI32(1));
      }

      circleOrderMetrics.totalCompletedOrdersCount =
        circleOrderMetrics.totalCompletedOrdersCount.minus(BigInt.fromI32(1));
      circleOrderMetrics.totalCancelledOrdersCount =
        circleOrderMetrics.totalCancelledOrdersCount.plus(BigInt.fromI32(1));
    } else if (
      previousStatus === ORDER_STATUS_CANCELLED &&
      newStatus === ORDER_STATUS_COMPLETED
    ) {
      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.cancelledBuyOrdersCount =
          orderMetrics.cancelledBuyOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.cancelledSellOrdersCount =
          orderMetrics.cancelledSellOrdersCount.minus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.cancelledPayOrdersCount =
          orderMetrics.cancelledPayOrdersCount.minus(BigInt.fromI32(1));
      }

      if (orderType === ORDER_TYPE_BUY) {
        orderMetrics.completedBuyOrdersCount =
          orderMetrics.completedBuyOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_SELL) {
        orderMetrics.completedSellOrdersCount =
          orderMetrics.completedSellOrdersCount.plus(BigInt.fromI32(1));
      } else if (orderType === ORDER_TYPE_PAY) {
        orderMetrics.completedPayOrdersCount =
          orderMetrics.completedPayOrdersCount.plus(BigInt.fromI32(1));
      }

      circleOrderMetrics.totalCancelledOrdersCount =
        circleOrderMetrics.totalCancelledOrdersCount.minus(BigInt.fromI32(1));
      circleOrderMetrics.totalCompletedOrdersCount =
        circleOrderMetrics.totalCompletedOrdersCount.plus(BigInt.fromI32(1));
    } else if (
      previousStatus !== ORDER_STATUS_COMPLETED &&
      previousStatus !== ORDER_STATUS_CANCELLED
    ) {
      if (newStatus === ORDER_STATUS_COMPLETED) {
        if (orderType === ORDER_TYPE_BUY) {
          orderMetrics.completedBuyOrdersCount =
            orderMetrics.completedBuyOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_SELL) {
          orderMetrics.completedSellOrdersCount =
            orderMetrics.completedSellOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_PAY) {
          orderMetrics.completedPayOrdersCount =
            orderMetrics.completedPayOrdersCount.plus(BigInt.fromI32(1));
        }

        circleOrderMetrics.totalCompletedOrdersCount =
          circleOrderMetrics.totalCompletedOrdersCount.plus(BigInt.fromI32(1));
      } else if (newStatus === ORDER_STATUS_CANCELLED) {
        if (orderType === ORDER_TYPE_BUY) {
          orderMetrics.cancelledBuyOrdersCount =
            orderMetrics.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_SELL) {
          orderMetrics.cancelledSellOrdersCount =
            orderMetrics.cancelledSellOrdersCount.plus(BigInt.fromI32(1));
        } else if (orderType === ORDER_TYPE_PAY) {
          orderMetrics.cancelledPayOrdersCount =
            orderMetrics.cancelledPayOrdersCount.plus(BigInt.fromI32(1));
        }

        circleOrderMetrics.totalCancelledOrdersCount =
          circleOrderMetrics.totalCancelledOrdersCount.plus(BigInt.fromI32(1));
      }
    }
    orderMetrics.save();
    circleOrderMetrics.save();
  }

  // Update dispute metrics (raised/resolved counts)
  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

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
      circleMetrics.merchantFaultDisputesCount =
        circleMetrics.merchantFaultDisputesCount.plus(BigInt.fromI32(1));

      const dayNum = getDayNumber(event.block.timestamp);
      const dailyKey = getDailyMetricsKey(circle, dayNum);
      let daily = loadCircleDailyMetrics(dailyKey, event);
      daily.circle = circle;
      daily.dayNumber = BigInt.fromI32(dayNum);
      daily.merchantFaultDisputesCount = daily.merchantFaultDisputesCount.plus(
        BigInt.fromI32(1),
      );
      daily.save();

      if (circleMetrics.totalCompletedOrders.gt(BigInt.zero())) {
        circleMetrics.totalCompletedOrders =
          circleMetrics.totalCompletedOrders.minus(BigInt.fromI32(1));

        if (circleMetrics.totalCompletedOrders.gt(BigInt.zero())) {
          circleMetrics.cumulativeSettlementSeconds =
            circleMetrics.cumulativeSettlementSeconds.minus(
              circleMetrics.avgSettlementSeconds,
            );

          circleMetrics.avgSettlementSeconds =
            circleMetrics.cumulativeSettlementSeconds.div(
              circleMetrics.totalCompletedOrders,
            );
        } else {
          circleMetrics.cumulativeSettlementSeconds = BigInt.zero();
          circleMetrics.avgSettlementSeconds = BigInt.zero();
        }
      }
    }

    compute30dMetrics(circleMetrics, event.block.timestamp);
    updateCircleScore(circleMetrics);

    applyTrustFirewall(circleMetrics);

    circleMetrics.lastScoreUpdateTimestamp = event.block.timestamp;
  }

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

    const orderType = event.params._order.orderType;

    // UPDATE CANCELLED ORDERS COUNT
    if (orderType === ORDER_TYPE_BUY) {
      orderMetrics.cancelledBuyOrdersCount =
        orderMetrics.cancelledBuyOrdersCount.plus(BigInt.fromI32(1));
    } else if (orderType === ORDER_TYPE_SELL) {
      orderMetrics.cancelledSellOrdersCount =
        orderMetrics.cancelledSellOrdersCount.plus(BigInt.fromI32(1));
    } else if (orderType === ORDER_TYPE_PAY) {
      orderMetrics.cancelledPayOrdersCount =
        orderMetrics.cancelledPayOrdersCount.plus(BigInt.fromI32(1));
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
    circleOrderMetrics.totalCancelledOrdersCount =
      circleOrderMetrics.totalCancelledOrdersCount.plus(BigInt.fromI32(1));
    circleOrderMetrics.save();
  }
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
    let circleMetrics = loadCircleMetrics(circle, event);
    circleMetrics.lifetimeAcceptedOrders =
      circleMetrics.lifetimeAcceptedOrders.plus(BigInt.fromI32(1));
    circleMetrics.save();

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

  const orderType = event.params._order.orderType;

  // UPDATE COMPLETED ORDERS COUNT
  if (orderType === ORDER_TYPE_BUY) {
    orderMetrics.completedBuyOrdersCount =
      orderMetrics.completedBuyOrdersCount.plus(BigInt.fromI32(1));
  } else if (orderType === ORDER_TYPE_SELL) {
    orderMetrics.completedSellOrdersCount =
      orderMetrics.completedSellOrdersCount.plus(BigInt.fromI32(1));
  } else if (orderType === ORDER_TYPE_PAY) {
    orderMetrics.completedPayOrdersCount =
      orderMetrics.completedPayOrdersCount.plus(BigInt.fromI32(1));
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
  circleOrderMetrics.totalCompletedOrdersCount =
    circleOrderMetrics.totalCompletedOrdersCount.plus(BigInt.fromI32(1));
  circleOrderMetrics.save();

  // Update circle volume metrics
  let circleMetrics = loadCircleMetrics(circle, event);

  if (!circleMetrics) return;

  circleMetrics.totalVolume = circleMetrics.totalVolume.plus(
    event.params._order.amount,
  );

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
          updateSettlementTime(circleMetrics, settlementSeconds);

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
    compute30dMetrics(circleMetrics, event.block.timestamp);

    // Update circle score
    updateCircleScore(circleMetrics);

    // Check lifecycle transitions
    checkBootstrapGraduation(circleMetrics);
    applyTrustFirewall(circleMetrics);

    // Update timestamp
    circleMetrics.lastScoreUpdateTimestamp = event.block.timestamp;
  }

  circleMetrics.save();

  // UPDATE CAMPAIGN VOLUME
  let user = loadUser(event.params._order.user, event);
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
    user.save();
  }
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

function applyActiveOrDefaultStatus(circleMetrics: CircleMetrics): void {
  if (
    circleMetrics.lifetimeAcceptedOrders.ge(BigInt.fromI32(40)) ||
    circleMetrics.totalVolume.ge(BigInt.fromI64(20_000_000_000))
  ) {
    circleMetrics.circleStatus = "active";
  } else {
    circleMetrics.circleStatus = "bootstrap";
  }
  updateCircleScore(circleMetrics);
  applyTrustFirewall(circleMetrics);
}

export function handleCircleStatusUpdated(
  event: CircleStatusUpdatedEvent,
): void {
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  let circle = loadCircle(circleKey, event);
  let circleMetrics = loadCircleMetrics(circle.id, event);

  if (event.params.newStatus == ONCHAIN_STATUS_REJECTED) {
    circleMetrics.circleStatus = "rejected";
    circleMetrics.circleScore = BigInt.zero();
  } else if (
    event.params.newStatus == ONCHAIN_STATUS_ACTIVE ||
    event.params.newStatus == ONCHAIN_STATUS_DEFAULT
  ) {
    applyActiveOrDefaultStatus(circleMetrics);
  } else if (event.params.newStatus == ONCHAIN_STATUS_INACTIVE) {
    circleMetrics.circleStatus = "inactive";
    circleMetrics.circleScore = BigInt.zero();
  }

  circleMetrics.save();
}
