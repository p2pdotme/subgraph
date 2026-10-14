import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { PaymentChannelConfigChanged } from "../generated/CountryFacet/CountryFacet";
import { PaymentChannelConfigUpdate } from "../generated/SetterFacet/SetterFacet";
import { handlePaymentChannelConfigChanged } from "../src/country-facet";
import { handlePaymentChannelConfigUpdate } from "../src/setter-facet";
import { paymentChannelConfigId } from "../src/lib";
import { CURRENCY_INR } from "./order-events";

function changed(limit: i32): PaymentChannelConfigChanged {
  const e = changetype<PaymentChannelConfigChanged>(newMockEvent());
  const cfg = new ethereum.Tuple();
  cfg.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)));
  cfg.push(ethereum.Value.fromString("SBI"));
  cfg.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(limit)));
  cfg.push(ethereum.Value.fromFixedBytes(CURRENCY_INR));
  cfg.push(ethereum.Value.fromBoolean(true));
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(
    new ethereum.EventParam("cfg", ethereum.Value.fromTuple(cfg)),
  );
  return e;
}

function updated(limit: i32): PaymentChannelConfigUpdate {
  const e = changetype<PaymentChannelConfigUpdate>(newMockEvent());
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(
    new ethereum.EventParam(
      "paymentChannelId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
    ),
  );
  e.parameters.push(
    new ethereum.EventParam("currency", ethereum.Value.fromFixedBytes(CURRENCY_INR)),
  );
  e.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString("SBI")),
  );
  e.parameters.push(
    new ethereum.EventParam(
      "dailyVolumeLimit",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(limit)),
    ),
  );
  e.parameters.push(
    new ethereum.EventParam("isActive", ethereum.Value.fromBoolean(true)),
  );
  return e;
}

describe("PaymentChannelConfig id", () => {
  afterEach(() => {
    clearStore();
  });

  test("both config events write one row per channel; the latest wins", () => {
    // Mainnet channel 1 (SBI): 0x01 kept 750000000 from SetterFacet while
    // 0x01000000 held the current 800000000 from CountryFacet.
    handlePaymentChannelConfigUpdate(updated(750000000));
    handlePaymentChannelConfigChanged(changed(800000000));

    const id = paymentChannelConfigId(BigInt.fromI32(1)).toHexString();
    // Same id however the BigInt was built
    assert.stringEquals(id, Bytes.fromI32(1).toHexString());
    assert.entityCount("PaymentChannelConfig", 1);
    assert.fieldEquals("PaymentChannelConfig", id, "dailyVolumeLimit", "800000000");

    handlePaymentChannelConfigUpdate(updated(900000000));
    assert.entityCount("PaymentChannelConfig", 1);
    assert.fieldEquals("PaymentChannelConfig", id, "dailyVolumeLimit", "900000000");
  });
});
