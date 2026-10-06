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
  CircleAdminHistorySeeded,
  CircleAdminUpdated,
} from "../generated/CircleFacet/CircleFacet";
import {
  handleCircleAdminHistorySeeded,
  handleCircleAdminUpdated,
} from "../src/circle-facet";

const ALICE = Address.fromString("0x000000000000000000000000000000000000000a");
const BOB = Address.fromString("0x000000000000000000000000000000000000000b");
const CAROL = Address.fromString("0x000000000000000000000000000000000000000e");
const DIAMOND = Address.fromString(
  "0x4cad6ec90e65babec9335cad728ddc610c316368",
);
const CIRCLE_ID = BigInt.fromI32(4);
const CIRCLE_KEY = changetype<Bytes>(Bytes.fromBigInt(CIRCLE_ID));

let nextLogIndex = 0;

// Module scope: AssemblyScript has no closures.
function baseEvent<T extends ethereum.Event>(): T {
  const mock = newMockEvent();
  const e = changetype<T>(mock);
  e.address = DIAMOND;
  e.logIndex = BigInt.fromI32(nextLogIndex++);
  e.parameters = new Array<ethereum.EventParam>();
  return e;
}

function param(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

function seededEvent(admin: Address, until: i32): CircleAdminHistorySeeded {
  const e = baseEvent<CircleAdminHistorySeeded>();
  e.parameters.push(
    param("circleId", ethereum.Value.fromUnsignedBigInt(CIRCLE_ID)),
  );
  e.parameters.push(param("admin", ethereum.Value.fromAddress(admin)));
  e.parameters.push(
    param("until", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(until))),
  );
  return e;
}

function adminUpdatedEvent(
  oldAdmin: Address,
  newAdmin: Address,
): CircleAdminUpdated {
  const e = baseEvent<CircleAdminUpdated>();
  e.parameters.push(
    param("circleId", ethereum.Value.fromUnsignedBigInt(CIRCLE_ID)),
  );
  e.parameters.push(param("oldAdmin", ethereum.Value.fromAddress(oldAdmin)));
  e.parameters.push(param("newAdmin", ethereum.Value.fromAddress(newAdmin)));
  return e;
}

describe("CircleFacet — R8.2 seeded circle-admin history", () => {
  afterEach(() => {
    clearStore();
  });

  test("seeded rows accumulate and never touch the current admin", () => {
    handleCircleAdminUpdated(adminUpdatedEvent(ALICE, CAROL));
    // The cut replays seats already replaced, with `until` in the past. Writing
    // `Circle.admin` from one would hand the circle back to a former admin —
    // the seed is history, and the live seat is CircleAdminUpdated's alone.
    handleCircleAdminHistorySeeded(seededEvent(ALICE, 1000));
    handleCircleAdminHistorySeeded(seededEvent(BOB, 2000));

    assert.entityCount("CircleAdminHistory", 2);
    assert.fieldEquals(
      "Circle",
      CIRCLE_KEY.toHexString(),
      "admin",
      CAROL.toHexString(),
    );
  });
});
