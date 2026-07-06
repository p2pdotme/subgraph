import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { UsdcDelegatedToMerchantInCircle } from "../generated/USDCStakeDelegationFacet/USDCStakeDelegationFacet";
import { MerchantRegisteredToCircle } from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import { CircleMerchant } from "../generated/schema";
import { handleUsdcDelegatedToMerchantInCircle } from "../src/stake-delegation";
import { handleMerchantRegisteredToCircle } from "../src/circle-merchants";

const MERCHANT = "0x0000000000000000000000000000000000000001";

function circleKeyHex(circleId: i32): string {
  return changetype<Bytes>(
    Bytes.fromBigInt(BigInt.fromI32(circleId)),
  ).toHexString();
}

function createDelegatedEvent(
  circleId: BigInt,
  merchant: Address,
  amount: BigInt,
): UsdcDelegatedToMerchantInCircle {
  const mock = newMockEvent();
  const event = new UsdcDelegatedToMerchantInCircle(
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
      "circleId",
      ethereum.Value.fromUnsignedBigInt(circleId),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(merchant)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount),
    ),
  );
  return event;
}

function createRegisteredEvent(
  merchant: Address,
  circleId: BigInt,
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
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(merchant)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "circleId",
      ethereum.Value.fromUnsignedBigInt(circleId),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "stakeAmount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("telegramId", ethereum.Value.fromString("tg")),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "currency",
      ethereum.Value.fromBytes(Bytes.fromUTF8("ARS")),
    ),
  );
  return event;
}

describe("CircleMerchant circle backfill", () => {
  afterEach(() => {
    clearStore();
  });

  test("delegation to an unregistered merchant adopts it into the circle", () => {
    const merchant = Address.fromString(MERCHANT);
    handleUsdcDelegatedToMerchantInCircle(
      createDelegatedEvent(BigInt.fromI32(7), merchant, BigInt.fromI32(100)),
    );

    assert.fieldEquals("CircleMerchant", MERCHANT, "circleId", "7");
    assert.fieldEquals("CircleMerchant", MERCHANT, "circle", circleKeyHex(7));
    // The referenced Circle entity must exist so the link never dangles.
    assert.entityCount("Circle", 1);
  });

  test("delegation never overwrites an already-registered merchant's circle", () => {
    const merchant = Address.fromString(MERCHANT);
    handleMerchantRegisteredToCircle(
      createRegisteredEvent(merchant, BigInt.fromI32(5)),
    );
    handleUsdcDelegatedToMerchantInCircle(
      createDelegatedEvent(BigInt.fromI32(9), merchant, BigInt.fromI32(100)),
    );

    assert.fieldEquals("CircleMerchant", MERCHANT, "circleId", "5");
    assert.fieldEquals("CircleMerchant", MERCHANT, "circle", circleKeyHex(5));
  });

  test("a stub with no circleId in the event keeps a null circle link", () => {
    const merchant = Address.fromString(MERCHANT);
    handleUsdcDelegatedToMerchantInCircle(
      createDelegatedEvent(BigInt.zero(), merchant, BigInt.fromI32(100)),
    );

    assert.fieldEquals("CircleMerchant", MERCHANT, "circleId", "0");
    const stub = CircleMerchant.load(Bytes.fromHexString(MERCHANT));
    assert.assertNotNull(stub);
    assert.assertTrue(stub!.circle === null);
  });
});
