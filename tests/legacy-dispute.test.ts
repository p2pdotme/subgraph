import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
} from "matchstick-as/assembly/index";
import { Address } from "@graphprotocol/graph-ts";
import {
  handleLegacyCancelledOrders,
  handleLegacyOrderCancelledBy,
  handleLegacyOrderCompleted,
  handleLegacyOrderDispute,
  handleLegacyOrderDisputeV2,
} from "../src/legacy-order";
import {
  CURRENCY_INR,
  OrderFields,
  legacyCancelledOrders,
  legacyOrderCancelledBy,
  legacyOrderCompleted,
  legacyOrderDispute,
  legacyOrderDisputeV2,
} from "./order-events";

// Pre-COT adminSettleDispute(orderId, bool userFault) (contracts-v4
// 88c71f0^) also cancels/completes before it emits OrderDispute; on prod 624
// legacy orders were completed and then cancelled by a settlement.

const USER = Address.fromString("0x00000000000000000000000000000000000000bb");
const MERCHANT = Address.fromString(
  "0x00000000000000000000000000000000000000aa",
);
const ADMIN = Address.fromString("0x00000000000000000000000000000000000000cc");

const T1 = 1760000000; // 2025-10-09, completion
const T2 = 1762000000; // 2025-11-01, settlement

function completedThenCancelled(): OrderFields {
  const f = new OrderFields();
  f.orderType = 1; // SELL
  f.user = USER;
  f.merchant = MERCHANT;
  f.status = 3;
  f.completedTimestamp = T1;
  handleLegacyOrderCompleted(legacyOrderCompleted(f, T1));

  f.status = 4;
  f.disputeStatus = 1;
  handleLegacyCancelledOrders(legacyCancelledOrders(f, T2));
  handleLegacyOrderCancelledBy(legacyOrderCancelledBy(f, ADMIN, T2));
  f.disputeStatus = 2;
  return f;
}

describe("legacy dispute settlement", () => {
  afterEach(() => {
    clearStore();
  });

  test("a pre-faultType settlement overturning a completion reverses it", () => {
    const f = completedThenCancelled();
    handleLegacyOrderDispute(legacyOrderDispute(f, ADMIN, T2));

    const stats = CURRENCY_INR.toHexString();
    assert.fieldEquals("LegacyStats", stats, "completedOrdersCount", "0");
    assert.fieldEquals("LegacyStats", stats, "cancelledOrdersCount", "1");
    assert.fieldEquals("LegacyStats", stats, "totalVolume", "0");
    assert.fieldEquals("User", USER.toHexString(), "completedSellOrdersCount", "0");
    assert.fieldEquals("User", USER.toHexString(), "cancelledSellOrdersCount", "1");
    assert.fieldEquals("User", USER.toHexString(), "totalVolume", "0");
  });

  test("a faultType settlement overturning a completion reverses it", () => {
    const f = completedThenCancelled();
    handleLegacyOrderDisputeV2(legacyOrderDisputeV2(f, 2, ADMIN, T2));

    const stats = CURRENCY_INR.toHexString();
    assert.fieldEquals("LegacyStats", stats, "completedOrdersCount", "0");
    assert.fieldEquals("LegacyStats", stats, "cancelledOrdersCount", "1");
    assert.fieldEquals("User", USER.toHexString(), "completedSellOrdersCount", "0");
    assert.fieldEquals("User", USER.toHexString(), "cancelledSellOrdersCount", "1");
  });

  test("a user-fault settlement changes nothing", () => {
    const f = new OrderFields();
    f.orderType = 1;
    f.user = USER;
    f.merchant = MERCHANT;
    f.status = 3;
    f.completedTimestamp = T1;
    handleLegacyOrderCompleted(legacyOrderCompleted(f, T1));
    f.disputeStatus = 2;
    handleLegacyOrderDisputeV2(legacyOrderDisputeV2(f, 1, ADMIN, T2));

    const stats = CURRENCY_INR.toHexString();
    assert.fieldEquals("LegacyStats", stats, "completedOrdersCount", "1");
    assert.fieldEquals("User", USER.toHexString(), "completedSellOrdersCount", "1");
  });
});
