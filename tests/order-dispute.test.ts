import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  handleCancelledOrders,
  handleOrderCancelledBy,
  handleOrderCompleted,
  handleOrderDisputeWithFaultType,
} from "../src/order";
import { getDailyMetricsKey, getDayNumber } from "../src/lib";
import { getYearMonthFromTimestamp } from "../src/utils/date.utils";
import {
  OrderFields,
  cancelledOrders,
  orderCancelledBy,
  orderCompleted,
  orderDispute,
} from "./order-events";

// adminSettleDispute calls completeOrder/cancelOrder before it emits
// OrderDispute, so on mainnet the settle tx logs CancelledOrders (or
// OrderCompleted), then OrderCancelledBy, then OrderDispute (tx 0x33ce92c5…:
// logs 153, 154, 156). These tests replay that order.

const USER = Address.fromString("0x00000000000000000000000000000000000000bb");
const MERCHANT = Address.fromString(
  "0x00000000000000000000000000000000000000aa",
);
const ADMIN = Address.fromString("0x00000000000000000000000000000000000000cc");

const T1 = 1785000000; // 2026-07-25, completion (or first cancel)
const T2 = 1788000000; // 2026-08-29, dispute settlement

const FAULT_USER = 1;
const FAULT_MERCHANT = 2;

function circleKey(): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(2)));
}

function merchantMonth(ts: i32): string {
  const month = getYearMonthFromTimestamp(BigInt.fromI32(ts));
  return Bytes.fromUTF8(`${MERCHANT.toHexString()}-${month}`).toHexString();
}

function circleMonth(ts: i32): string {
  const month = getYearMonthFromTimestamp(BigInt.fromI32(ts));
  return Bytes.fromUTF8(`${circleKey().toHexString()}-${month}`).toHexString();
}

function circleDay(ts: i32): string {
  return getDailyMetricsKey(
    circleKey(),
    getDayNumber(BigInt.fromI32(ts)),
  ).toHexString();
}

function sellOrder(): OrderFields {
  const f = new OrderFields();
  f.orderType = 1;
  f.user = USER;
  f.merchant = MERCHANT;
  return f;
}

describe("dispute settlement", () => {
  afterEach(() => {
    clearStore();
  });

  test("merchant fault overturning a completed SELL reverses the completion", () => {
    const f = sellOrder();
    f.status = 3;
    f.completedTimestamp = T1;
    handleOrderCompleted(orderCompleted(f, T1));
    assert.fieldEquals("CircleMerchant", MERCHANT.toHexString(), "lifetimeCompletedCount", "1");

    // Settle tx: CancelledOrders (dispute still RAISED), OrderCancelledBy,
    // then OrderDispute (SETTLED). completedTimestamp stays set on-chain.
    f.status = 4;
    f.disputeStatus = 1;
    handleCancelledOrders(cancelledOrders(f, T2));
    handleOrderCancelledBy(orderCancelledBy(f, ADMIN, T2));
    f.disputeStatus = 2;
    handleOrderDisputeWithFaultType(orderDispute(f, FAULT_MERCHANT, ADMIN, T2));

    assert.fieldEquals("CircleMerchant", MERCHANT.toHexString(), "lifetimeCompletedCount", "0");
    // Completion month: completed comes off, nothing cancelled lands there
    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T1), "completedSellOrdersCount", "0");
    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T1), "cancelledSellOrdersCount", "0");
    assert.fieldEquals("CircleOrderMetricsByMonth", circleMonth(T1), "completedSellOrdersCount", "0");
    // Settle month: the cancel is counted exactly once (by CancelledOrders)
    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T2), "cancelledSellOrdersCount", "1");
    assert.fieldEquals("CircleOrderMetricsByMonth", circleMonth(T2), "cancelledSellOrdersCount", "1");
    assert.fieldEquals("User", USER.toHexString(), "completedSellOrdersCount", "0");
    assert.fieldEquals("User", USER.toHexString(), "cancelledSellOrdersCount", "1");
    assert.fieldEquals("User", USER.toHexString(), "totalVolume", "0");
    // The dispute counts toward the circle score, on the settle day
    assert.fieldEquals("CircleScoreState", circleKey().toHexString(), "merchantFaultDisputesCount", "1");
    assert.fieldEquals("CircleDailyMetrics", circleDay(T2), "merchantFaultDisputesCount", "1");
  });

  test("merchant fault on a never-completed SELL counts the dispute only", () => {
    const f = sellOrder();
    f.status = 4;
    f.disputeStatus = 1;
    handleCancelledOrders(cancelledOrders(f, T2));
    handleOrderCancelledBy(orderCancelledBy(f, ADMIN, T2));
    f.disputeStatus = 2;
    handleOrderDisputeWithFaultType(orderDispute(f, FAULT_MERCHANT, ADMIN, T2));

    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T2), "cancelledSellOrdersCount", "1");
    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T2), "completedSellOrdersCount", "0");
    assert.fieldEquals("CircleMerchant", MERCHANT.toHexString(), "lifetimeCompletedCount", "0");
    assert.fieldEquals("CircleScoreState", circleKey().toHexString(), "merchantFaultDisputesCount", "1");
  });

  test("merchant fault reopening a cancelled BUY to COMPLETED reverses the cancel", () => {
    const f = sellOrder();
    f.orderType = 0;
    f.status = 4;
    handleCancelledOrders(cancelledOrders(f, T1));
    handleOrderCancelledBy(orderCancelledBy(f, USER, T1));

    f.status = 3;
    f.disputeStatus = 1;
    f.completedTimestamp = T2;
    handleOrderCompleted(orderCompleted(f, T2));
    f.disputeStatus = 2;
    handleOrderDisputeWithFaultType(orderDispute(f, FAULT_MERCHANT, ADMIN, T2));

    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T1), "cancelledBuyOrdersCount", "0");
    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T2), "completedBuyOrdersCount", "1");
    assert.fieldEquals("User", USER.toHexString(), "cancelledBuyOrdersCount", "0");
    assert.fieldEquals("User", USER.toHexString(), "completedBuyOrdersCount", "1");
    assert.fieldEquals("CircleScoreState", circleKey().toHexString(), "merchantFaultDisputesCount", "1");
  });

  test("user fault leaves the order and the score alone", () => {
    const f = sellOrder();
    f.status = 2; // PAID
    f.disputeStatus = 2;
    handleOrderDisputeWithFaultType(orderDispute(f, FAULT_USER, ADMIN, T2));

    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T2), "completedSellOrdersCount", "0");
    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T2), "cancelledSellOrdersCount", "0");
    assert.fieldEquals("CircleScoreState", circleKey().toHexString(), "merchantFaultDisputesCount", "0");
  });

  test("a missed CancelledOrders log still swaps completed for cancelled", () => {
    const f = sellOrder();
    f.status = 3;
    f.completedTimestamp = T1;
    handleOrderCompleted(orderCompleted(f, T1));

    f.status = 4;
    f.disputeStatus = 2;
    handleOrderDisputeWithFaultType(orderDispute(f, FAULT_MERCHANT, ADMIN, T2));

    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T1), "completedSellOrdersCount", "0");
    assert.fieldEquals("MerchantOrderMetricsByMonth", merchantMonth(T1), "cancelledSellOrdersCount", "1");
    assert.fieldEquals("CircleMerchant", MERCHANT.toHexString(), "lifetimeCompletedCount", "0");
    assert.fieldEquals("CircleScoreState", circleKey().toHexString(), "merchantFaultDisputesCount", "1");
  });
});
