import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  DailyBuyOrderPlacementLimitUpdated,
  DailySellOrderPlacementLimitUpdated,
} from "../generated/SetterFacet/SetterFacet";
import {
  handleDailyBuyOrderPlacementLimitUpdated,
  handleDailySellOrderPlacementLimitUpdated,
} from "../src/setter-facet";
import { recordPlacement } from "../src/lib";
import {
  ORDER_TYPE_BUY,
  ORDER_TYPE_PAY,
  ORDER_TYPE_SELL,
} from "../src/constants/status";

const USER = "0x0000000000000000000000000000000000000001";
const OTHER_USER = "0x0000000000000000000000000000000000000002";

const SECONDS_PER_DAY = 86400;
// Arbitrary UTC midnight-ish timestamp; DAY_ONE and DAY_TWO straddle a boundary.
const DAY_ONE_TS = 1893456000; // 2030-01-01T00:00:00Z
const DAY_TWO_TS = DAY_ONE_TS + SECONDS_PER_DAY;

const CONFIG_ID = Bytes.fromUTF8("placement-limits");

function mockEventAt(timestamp: i32): ethereum.Event {
  const event = newMockEvent();
  event.block.timestamp = BigInt.fromI32(timestamp);
  return event;
}

function placementsId(user: string, timestamp: i32): string {
  const dayIndex = timestamp / SECONDS_PER_DAY;
  return Bytes.fromUTF8(`${user}-${dayIndex.toString()}`).toHexString();
}

function limitParams(limit: BigInt): Array<ethereum.EventParam> {
  const params = new Array<ethereum.EventParam>();
  params.push(
    new ethereum.EventParam("limit", ethereum.Value.fromUnsignedBigInt(limit)),
  );
  return params;
}

function createSellLimitUpdatedEvent(
  limit: BigInt,
  timestamp: i32,
): DailySellOrderPlacementLimitUpdated {
  const mock = mockEventAt(timestamp);
  const event = new DailySellOrderPlacementLimitUpdated(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  event.parameters = limitParams(limit);
  return event;
}

function createBuyLimitUpdatedEvent(
  limit: BigInt,
  timestamp: i32,
): DailyBuyOrderPlacementLimitUpdated {
  const mock = mockEventAt(timestamp);
  const event = new DailyBuyOrderPlacementLimitUpdated(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  event.parameters = limitParams(limit);
  return event;
}

describe("UserDailyPlacements", () => {
  afterEach(() => {
    clearStore();
  });

  test("SELL and PAY share one bucket, BUY has its own", () => {
    const user = Address.fromString(USER);
    recordPlacement(user, ORDER_TYPE_SELL, mockEventAt(DAY_ONE_TS));
    recordPlacement(user, ORDER_TYPE_SELL, mockEventAt(DAY_ONE_TS));
    recordPlacement(user, ORDER_TYPE_PAY, mockEventAt(DAY_ONE_TS));
    recordPlacement(user, ORDER_TYPE_BUY, mockEventAt(DAY_ONE_TS));

    const id = placementsId(USER, DAY_ONE_TS);
    assert.fieldEquals("UserDailyPlacements", id, "sellPlacements", "3");
    assert.fieldEquals("UserDailyPlacements", id, "buyPlacements", "1");
  });

  test("counts are gross — nothing ever gives a placement back", () => {
    // There is deliberately no cancellation path that decrements: the whole
    // point of the on-chain counter is that a place→cancel loop still burns
    // the allowance. Replaying placements only ever adds.
    const user = Address.fromString(USER);
    for (let i = 0; i < 20; i++) {
      recordPlacement(user, ORDER_TYPE_SELL, mockEventAt(DAY_ONE_TS));
    }

    assert.fieldEquals(
      "UserDailyPlacements",
      placementsId(USER, DAY_ONE_TS),
      "sellPlacements",
      "20",
    );
  });

  test("a new UTC day starts a fresh bucket", () => {
    const user = Address.fromString(USER);
    recordPlacement(user, ORDER_TYPE_SELL, mockEventAt(DAY_ONE_TS));
    recordPlacement(user, ORDER_TYPE_SELL, mockEventAt(DAY_TWO_TS));

    assert.fieldEquals(
      "UserDailyPlacements",
      placementsId(USER, DAY_ONE_TS),
      "sellPlacements",
      "1",
    );
    assert.fieldEquals(
      "UserDailyPlacements",
      placementsId(USER, DAY_TWO_TS),
      "sellPlacements",
      "1",
    );
    // dayIndex must equal the contract's getDayKey (timestamp / 86400) so the
    // bucket here and the contract's mapping entry describe the same window.
    assert.fieldEquals(
      "UserDailyPlacements",
      placementsId(USER, DAY_TWO_TS),
      "dayIndex",
      (DAY_TWO_TS / SECONDS_PER_DAY).toString(),
    );
  });

  test("buckets are per user", () => {
    recordPlacement(
      Address.fromString(USER),
      ORDER_TYPE_SELL,
      mockEventAt(DAY_ONE_TS),
    );
    recordPlacement(
      Address.fromString(OTHER_USER),
      ORDER_TYPE_SELL,
      mockEventAt(DAY_ONE_TS),
    );

    assert.fieldEquals(
      "UserDailyPlacements",
      placementsId(USER, DAY_ONE_TS),
      "sellPlacements",
      "1",
    );
    assert.fieldEquals(
      "UserDailyPlacements",
      placementsId(OTHER_USER, DAY_ONE_TS),
      "sellPlacements",
      "1",
    );
  });

  test("an unrecognised order type is ignored rather than miscounted", () => {
    recordPlacement(Address.fromString(USER), 7, mockEventAt(DAY_ONE_TS));
    assert.entityCount("UserDailyPlacements", 0);
  });
});

describe("OrderPlacementLimitConfig", () => {
  afterEach(() => {
    clearStore();
  });

  test("the initializer seed and later setter calls land on one entity", () => {
    // PlacementLimitInit emits the same signature during the cut, so this
    // handler sees the seed first and the operational change second.
    handleDailySellOrderPlacementLimitUpdated(
      createSellLimitUpdatedEvent(BigInt.fromI32(20), DAY_ONE_TS),
    );
    const id = CONFIG_ID.toHexString();
    assert.entityCount("OrderPlacementLimitConfig", 1);
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "dailySellOrderPlacementLimit",
      "20",
    );
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "sellLimitConfigured",
      "true",
    );

    handleDailySellOrderPlacementLimitUpdated(
      createSellLimitUpdatedEvent(BigInt.fromI32(30), DAY_TWO_TS),
    );
    assert.entityCount("OrderPlacementLimitConfig", 1);
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "dailySellOrderPlacementLimit",
      "30",
    );
  });

  test("a sell limit of 0 is a configured value meaning unlimited", () => {
    handleDailySellOrderPlacementLimitUpdated(
      createSellLimitUpdatedEvent(BigInt.zero(), DAY_ONE_TS),
    );
    const id = CONFIG_ID.toHexString();
    // 0 with configured=true is "no cap", which a consumer must not render as
    // "0 orders left". Only configured=false means "we have not seen a value".
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "dailySellOrderPlacementLimit",
      "0",
    );
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "sellLimitConfigured",
      "true",
    );
  });

  test("the buy limit is tracked independently and starts unobserved", () => {
    handleDailySellOrderPlacementLimitUpdated(
      createSellLimitUpdatedEvent(BigInt.fromI32(20), DAY_ONE_TS),
    );
    const id = CONFIG_ID.toHexString();
    // The buy setter is new, so until someone calls it we have never observed
    // the buy limit — even though it has been 10 on-chain since launch.
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "buyLimitConfigured",
      "false",
    );
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "dailyBuyOrderPlacementLimit",
      "0",
    );

    handleDailyBuyOrderPlacementLimitUpdated(
      createBuyLimitUpdatedEvent(BigInt.fromI32(10), DAY_TWO_TS),
    );
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "buyLimitConfigured",
      "true",
    );
    assert.fieldEquals(
      "OrderPlacementLimitConfig",
      id,
      "dailyBuyOrderPlacementLimit",
      "10",
    );
  });
});
