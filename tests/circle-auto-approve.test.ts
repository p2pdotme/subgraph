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
  CircleAdminUpdated,
  CircleAutoApprovePaymentChannelsUpdated,
} from "../generated/CircleFacet/CircleFacet";
import {
  handleCircleAdminUpdated,
  handleCircleAutoApprovePaymentChannelsUpdated,
} from "../src/circle-facet";

const ALICE = Address.fromString("0x000000000000000000000000000000000000000a");
const CAROL = Address.fromString("0x000000000000000000000000000000000000000e");
const DIAMOND = Address.fromString(
  "0x4cad6ec90e65babec9335cad728ddc610c316368",
);
const CIRCLE_ID = BigInt.fromI32(17);
const OTHER_CIRCLE_ID = BigInt.fromI32(4);

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

function circleKey(circleId: BigInt): string {
  return changetype<Bytes>(Bytes.fromBigInt(circleId)).toHexString();
}

function adminUpdatedEvent(circleId: BigInt): CircleAdminUpdated {
  const e = baseEvent<CircleAdminUpdated>();
  e.parameters.push(
    param("circleId", ethereum.Value.fromUnsignedBigInt(circleId)),
  );
  e.parameters.push(param("oldAdmin", ethereum.Value.fromAddress(ALICE)));
  e.parameters.push(param("newAdmin", ethereum.Value.fromAddress(CAROL)));
  return e;
}

function autoApproveEvent(
  circleId: BigInt,
  autoApprove: boolean,
): CircleAutoApprovePaymentChannelsUpdated {
  const e = baseEvent<CircleAutoApprovePaymentChannelsUpdated>();
  e.parameters.push(
    param("circleId", ethereum.Value.fromUnsignedBigInt(circleId)),
  );
  e.parameters.push(
    param("autoApprove", ethereum.Value.fromBoolean(autoApprove)),
  );
  return e;
}

describe("CircleFacet — payment-channel auto-approval changed after creation", () => {
  afterEach(() => {
    clearStore();
  });

  test("the flag follows the event, on and off again", () => {
    handleCircleAdminUpdated(adminUpdatedEvent(CIRCLE_ID));

    handleCircleAutoApprovePaymentChannelsUpdated(
      autoApproveEvent(CIRCLE_ID, true),
    );
    assert.fieldEquals(
      "Circle",
      circleKey(CIRCLE_ID),
      "isAutoApprovedPCEnabled",
      "true",
    );

    handleCircleAutoApprovePaymentChannelsUpdated(
      autoApproveEvent(CIRCLE_ID, false),
    );
    assert.fieldEquals(
      "Circle",
      circleKey(CIRCLE_ID),
      "isAutoApprovedPCEnabled",
      "false",
    );
  });

  test("only that circle moves, and nothing else on it", () => {
    handleCircleAdminUpdated(adminUpdatedEvent(CIRCLE_ID));
    handleCircleAdminUpdated(adminUpdatedEvent(OTHER_CIRCLE_ID));

    handleCircleAutoApprovePaymentChannelsUpdated(
      autoApproveEvent(CIRCLE_ID, true),
    );

    assert.fieldEquals(
      "Circle",
      circleKey(OTHER_CIRCLE_ID),
      "isAutoApprovedPCEnabled",
      "false",
    );
    assert.fieldEquals(
      "Circle",
      circleKey(CIRCLE_ID),
      "admin",
      CAROL.toHexString(),
    );
    assert.entityCount("Circle", 2);
  });
});
