import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { CircleMerchantDetailsAndConfigUpdate } from "../generated/SetterFacet/SetterFacet";
import { MerchantRegisteredToCircle } from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import { handleCircleMerchantDetailsAndConfigUpdate } from "../src/setter-facet";
import { handleMerchantRegisteredToCircle } from "../src/circle-merchants";

const MERCHANT_A = "0x0000000000000000000000000000000000000001";
const MERCHANT_B = "0x0000000000000000000000000000000000000002";

function circleKeyHex(circleId: i32): string {
  return changetype<Bytes>(
    Bytes.fromBigInt(BigInt.fromI32(circleId)),
  ).toHexString();
}

function bigIntParam(name: string, value: i32): ethereum.EventParam {
  return new ethereum.EventParam(
    name,
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(value)),
  );
}

function boolParam(name: string, value: boolean): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromBoolean(value));
}

function createRegisteredEvent(
  merchant: string,
  circleId: i32,
  stake: i32,
): MerchantRegisteredToCircle {
  const mock = newMockEvent();
  const event = new MerchantRegisteredToCircle(
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
      "merchant",
      ethereum.Value.fromAddress(Address.fromString(merchant)),
    ),
  );
  event.parameters.push(bigIntParam("circleId", circleId));
  event.parameters.push(bigIntParam("stakeAmount", stake));
  event.parameters.push(
    new ethereum.EventParam("telegramId", ethereum.Value.fromString("tg")),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "currency",
      ethereum.Value.fromBytes(Bytes.fromUTF8("INR")),
    ),
  );
  return event;
}

function createDetailsUpdateEvent(
  merchant: string,
  circleId: i32,
  stake: i32,
  isOnline: boolean,
): CircleMerchantDetailsAndConfigUpdate {
  const mock = newMockEvent();
  const event = new CircleMerchantDetailsAndConfigUpdate(
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
      "merchant",
      ethereum.Value.fromAddress(Address.fromString(merchant)),
    ),
  );
  event.parameters.push(bigIntParam("circleId", circleId));
  event.parameters.push(
    new ethereum.EventParam(
      "currency",
      ethereum.Value.fromFixedBytes(Bytes.fromUTF8("INR")),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("telegramId", ethereum.Value.fromString("tg")),
  );
  event.parameters.push(bigIntParam("stake", stake));
  event.parameters.push(bigIntParam("delegatedStake", 0));
  event.parameters.push(boolParam("isOnline", isOnline));
  event.parameters.push(boolParam("isRegistered", true));
  event.parameters.push(boolParam("isBlacklisted", false));
  event.parameters.push(boolParam("isUnstakeRequested", false));
  event.parameters.push(bigIntParam("unstakeRequestedAt", 0));
  event.parameters.push(bigIntParam("unstakeAmount", 0));
  event.parameters.push(bigIntParam("startedAt", 1));
  event.parameters.push(bigIntParam("onlineAt", 1));
  event.parameters.push(bigIntParam("offlineAt", 0));
  return event;
}

describe("CircleMerchantDetailsAndConfigUpdate counters", () => {
  afterEach(() => {
    clearStore();
  });

  test("re-emitting an indexed merchant does not double-count it", () => {
    handleMerchantRegisteredToCircle(createRegisteredEvent(MERCHANT_A, 7, 100));
    handleCircleMerchantDetailsAndConfigUpdate(
      createDetailsUpdateEvent(MERCHANT_A, 7, 100, true),
    );
    handleCircleMerchantDetailsAndConfigUpdate(
      createDetailsUpdateEvent(MERCHANT_A, 7, 100, true),
    );

    const circle = circleKeyHex(7);
    assert.fieldEquals("CircleMetrics", circle, "totalMerchantsCount", "1");
    assert.fieldEquals("CircleScoreState", circle, "activeMerchantsCount", "1");
    assert.fieldEquals(
      "CircleScoreState",
      circle,
      "availableMerchantsCount",
      "1",
    );
  });

  test("a merchant first seen here joins the counts once and moves by delta", () => {
    handleCircleMerchantDetailsAndConfigUpdate(
      createDetailsUpdateEvent(MERCHANT_B, 7, 100, true),
    );
    const circle = circleKeyHex(7);
    assert.fieldEquals("CircleMetrics", circle, "totalMerchantsCount", "1");
    assert.fieldEquals("CircleScoreState", circle, "activeMerchantsCount", "1");
    assert.fieldEquals(
      "CircleScoreState",
      circle,
      "availableMerchantsCount",
      "1",
    );
    assert.fieldEquals("CircleMerchant", MERCHANT_B, "circle", circle);

    // Going offline removes it from active/available but not from the total.
    handleCircleMerchantDetailsAndConfigUpdate(
      createDetailsUpdateEvent(MERCHANT_B, 7, 100, false),
    );
    assert.fieldEquals("CircleMetrics", circle, "totalMerchantsCount", "1");
    assert.fieldEquals("CircleScoreState", circle, "activeMerchantsCount", "0");
    assert.fieldEquals(
      "CircleScoreState",
      circle,
      "availableMerchantsCount",
      "0",
    );
  });
});
