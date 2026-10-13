import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
} from "matchstick-as/assembly/index";
import { Address } from "@graphprotocol/graph-ts";
import { handleCancelledOrders } from "../src/order";
import { OrderFields, cancelledOrders } from "./order-events";

const USER = Address.fromString("0x00000000000000000000000000000000000000bb");
const MERCHANT = Address.fromString(
  "0x00000000000000000000000000000000000000aa",
);

describe("CancelledOrders merchant attribution", () => {
  afterEach(() => {
    clearStore();
  });

  test("a never-accepted cancel creates no 0x000…0 merchant", () => {
    // Mainnet: 20,791 never-accepted cancels were credited to a CircleMerchant
    // for address(0), whose backfilled circle 1 then counted them.
    const f = new OrderFields();
    f.status = 4;
    f.user = USER;
    f.merchant = Address.zero();
    handleCancelledOrders(cancelledOrders(f, 1788000000));

    assert.entityCount("CircleMerchant", 0);
    assert.entityCount("CircleOrderMetricsByMonth", 0);
    assert.entityCount("MerchantOrderMetricsByMonth", 0);
  });

  test("an accepted cancel is still credited to its merchant", () => {
    const f = new OrderFields();
    f.status = 4;
    f.user = USER;
    f.merchant = MERCHANT;
    handleCancelledOrders(cancelledOrders(f, 1788000000));

    assert.entityCount("CircleMerchant", 1);
    assert.entityCount("CircleOrderMetricsByMonth", 1);
    assert.fieldEquals(
      "CircleMerchant",
      MERCHANT.toHexString(),
      "circleId",
      "2",
    );
  });
});
