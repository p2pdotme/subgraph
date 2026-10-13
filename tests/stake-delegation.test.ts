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
  ExitProceedsWithdrawn,
  ExitRequested,
  UsdcStakedForDelegationInCircle,
} from "../generated/USDCStakeDelegationFacet/USDCStakeDelegationFacet";
import {
  handleExitProceedsWithdrawn,
  handleExitRequested,
  handleUsdcStakedForDelegationInCircle,
} from "../src/stake-delegation";

const USER = "0x6c1cd62701c3e13facb9e5948ffb9b00d98ec583";

function baseParams(
  event: ethereum.Event,
  circleId: i32,
  amount: i32,
): void {
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam(
      "user",
      ethereum.Value.fromAddress(Address.fromString(USER)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "circleId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(circleId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount)),
    ),
  );
}

function createStakedEvent(
  circleId: i32,
  amount: i32,
): UsdcStakedForDelegationInCircle {
  const mock = newMockEvent();
  const event = new UsdcStakedForDelegationInCircle(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  baseParams(event, circleId, amount);
  return event;
}

function createExitRequestedEvent(circleId: i32, amount: i32): ExitRequested {
  const mock = newMockEvent();
  const event = new ExitRequested(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  baseParams(event, circleId, amount);
  event.parameters.push(
    new ethereum.EventParam(
      "availableAt",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000)),
    ),
  );
  return event;
}

function createWithdrawnEvent(
  circleId: i32,
  amount: i32,
): ExitProceedsWithdrawn {
  const mock = newMockEvent();
  const event = new ExitProceedsWithdrawn(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  baseParams(event, circleId, amount);
  return event;
}

describe("CircleUsdcStakeRecord id", () => {
  afterEach(() => {
    clearStore();
  });

  test("stake, exit and withdraw for circle 20 index instead of aborting", () => {
    handleUsdcStakedForDelegationInCircle(createStakedEvent(20, 100));
    handleExitRequested(createExitRequestedEvent(20, 40));
    handleExitProceedsWithdrawn(createWithdrawnEvent(20, 40));

    const id = Bytes.fromUTF8(`20-${USER}`).toHexString();
    assert.entityCount("CircleUsdcStakeRecords", 1);
    assert.entityCount("CircleUsdcUnstakeRecords", 1);
    assert.fieldEquals("CircleUsdcStakeRecords", id, "amount", "60");
    assert.fieldEquals("CircleUsdcUnstakeRecords", id, "amount", "40");
  });

  test("circle 5 uses the same UTF-8 id format", () => {
    handleUsdcStakedForDelegationInCircle(createStakedEvent(5, 100));

    const id = Bytes.fromUTF8(`5-${USER}`).toHexString();
    assert.entityCount("CircleUsdcStakeRecords", 1);
    assert.fieldEquals("CircleUsdcStakeRecords", id, "amount", "100");
  });
});
