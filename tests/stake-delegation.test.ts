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
import { Staker } from "../generated/schema";
import { circleAccountId } from "../src/lib";

const USER = "0x6c1cd62701c3e13facb9e5948ffb9b00d98ec583";

function baseParams(event: ethereum.Event, circleId: i32, amount: i32): void {
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

  test("circle 5 keeps the legacy id", () => {
    handleUsdcStakedForDelegationInCircle(createStakedEvent(5, 100));

    const id = Bytes.fromHexString(`5-${USER}`).toHexString();
    assert.entityCount("CircleUsdcStakeRecords", 1);
    assert.fieldEquals("CircleUsdcStakeRecords", id, "amount", "100");
  });
});

describe("Staker record lists", () => {
  afterEach(() => {
    clearStore();
  });

  test("stake and exit records are persisted on the Staker, once per circle", () => {
    // Two stakes into circle 5 touch one record; circle 20 adds a second.
    handleUsdcStakedForDelegationInCircle(createStakedEvent(5, 100));
    handleUsdcStakedForDelegationInCircle(createStakedEvent(5, 50));
    handleUsdcStakedForDelegationInCircle(createStakedEvent(20, 10));
    handleExitRequested(createExitRequestedEvent(5, 30));
    handleExitRequested(createExitRequestedEvent(5, 30));

    const staker = Staker.load(Address.fromString(USER))!;
    const stakeRecords = staker.circleUsdcStakeRecords;
    assert.i32Equals(stakeRecords.length, 2);
    assert.bytesEquals(
      stakeRecords[0],
      circleAccountId(BigInt.fromI32(5), Address.fromString(USER)),
    );
    assert.bytesEquals(
      stakeRecords[1],
      circleAccountId(BigInt.fromI32(20), Address.fromString(USER)),
    );
    const unstakeRecords = staker.circleUsdcUnstakeRecords;
    assert.i32Equals(unstakeRecords.length, 1);
    assert.bytesEquals(
      unstakeRecords[0],
      circleAccountId(BigInt.fromI32(5), Address.fromString(USER)),
    );
    assert.fieldEquals("Staker", USER, "totalStaked", "160");
  });
});

describe("ExitProceedsWithdrawn without a prior ExitRequested", () => {
  afterEach(() => {
    clearStore();
  });

  test("indexes instead of aborting on the unstake record's non-null links", () => {
    // Simulates the ExitRequested log being dropped by the provider: the
    // unstake record is first written here and must carry circle + staker.
    handleUsdcStakedForDelegationInCircle(createStakedEvent(5, 100));
    handleExitProceedsWithdrawn(createWithdrawnEvent(5, 40));

    const id = Bytes.fromHexString(`5-${USER}`).toHexString();
    const circleId = changetype<Bytes>(
      Bytes.fromBigInt(BigInt.fromI32(5)),
    ).toHexString();
    assert.entityCount("CircleUsdcUnstakeRecords", 1);
    assert.fieldEquals("CircleUsdcUnstakeRecords", id, "circle", circleId);
    assert.fieldEquals("CircleUsdcUnstakeRecords", id, "staker", USER);
    assert.fieldEquals("CircleUsdcUnstakeRecords", id, "status", "1");
    assert.fieldEquals("CircleUsdcStakeRecords", id, "amount", "60");
    assert.fieldEquals("Staker", USER, "totalStaked", "60");
  });
});
