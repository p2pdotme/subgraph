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

const CURRENCY = Bytes.fromUTF8("INR");

function createConfigChangedEvent(
  paymentChannelId: i32,
  name: string,
  isActive: boolean,
): PaymentChannelConfigChanged {
  const mock = newMockEvent();
  const event = new PaymentChannelConfigChanged(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  const cfg: Array<ethereum.Value> = [
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(paymentChannelId)),
    ethereum.Value.fromString(name),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000)),
    ethereum.Value.fromFixedBytes(CURRENCY),
    ethereum.Value.fromBoolean(isActive),
  ];
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "cfg",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(cfg)),
    ),
  );
  return event;
}

function createConfigUpdateEvent(
  paymentChannelId: i32,
  name: string,
  isActive: boolean,
): PaymentChannelConfigUpdate {
  const mock = newMockEvent();
  const event = new PaymentChannelConfigUpdate(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "paymentChannelId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(paymentChannelId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "currency",
      ethereum.Value.fromFixedBytes(CURRENCY),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString(name)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "dailyVolumeLimit",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("isActive", ethereum.Value.fromBoolean(isActive)),
  );
  return event;
}

describe("PaymentChannelConfig id", () => {
  afterEach(() => {
    clearStore();
  });

  test("CountryFacet and SetterFacet events update the same row", () => {
    handlePaymentChannelConfigChanged(createConfigChangedEvent(3, "UPI", true));
    handlePaymentChannelConfigUpdate(
      createConfigUpdateEvent(3, "UPI v2", false),
    );

    const id = changetype<Bytes>(
      Bytes.fromBigInt(BigInt.fromI32(3)),
    ).toHexString();
    assert.entityCount("PaymentChannelConfig", 1);
    assert.fieldEquals("PaymentChannelConfig", id, "paymentChannelId", "3");
    assert.fieldEquals("PaymentChannelConfig", id, "name", "UPI v2");
    assert.fieldEquals("PaymentChannelConfig", id, "isActive", "false");
  });
});
