import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  CALRLocked,
  CALRUnlocked,
  CALRLockReverted,
} from "../generated/InsurancePoolFacet/InsurancePoolFacet";
import { CircleAdminClaimableRewardsCredited } from "../generated/InsuranceSinkFacet/InsuranceSinkFacet";
import {
  handleCALRLocked,
  handleCALRUnlocked,
  handleCALRLockReverted,
} from "../src/insurance-pool";
import { handleCircleAdminClaimableRewardsCredited } from "../src/insurance-sink";

const ADMIN = "0x000000000000000000000000000000000000000a";

function createCALRLockedEvent(
  admin: Address,
  amount: BigInt,
  lockExpiresAt: BigInt,
): CALRLocked {
  const mock = newMockEvent();
  const event = new CALRLocked(
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
    new ethereum.EventParam("admin", ethereum.Value.fromAddress(admin)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "lockExpiresAt",
      ethereum.Value.fromUnsignedBigInt(lockExpiresAt),
    ),
  );
  return event;
}

function createCALRUnlockedEvent(admin: Address, amount: BigInt): CALRUnlocked {
  const mock = newMockEvent();
  const event = new CALRUnlocked(
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
    new ethereum.EventParam("admin", ethereum.Value.fromAddress(admin)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount),
    ),
  );
  return event;
}

function createCALRLockRevertedEvent(
  orderId: BigInt,
  admin: Address,
  snapshot: BigInt,
  actual: BigInt,
): CALRLockReverted {
  const mock = newMockEvent();
  const event = new CALRLockReverted(
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
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("admin", ethereum.Value.fromAddress(admin)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "snapshot",
      ethereum.Value.fromUnsignedBigInt(snapshot),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "actual",
      ethereum.Value.fromUnsignedBigInt(actual),
    ),
  );
  return event;
}

function createClaimableCreditedEvent(
  admin: Address,
  amount: BigInt,
): CircleAdminClaimableRewardsCredited {
  const mock = newMockEvent();
  const event = new CircleAdminClaimableRewardsCredited(
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
    new ethereum.EventParam("admin", ethereum.Value.fromAddress(admin)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount),
    ),
  );
  return event;
}

describe("CALR ledger", () => {
  afterEach(() => {
    clearStore();
  });

  test("accumulates locks and tracks the latest lock window", () => {
    const admin = Address.fromString(ADMIN);
    handleCALRLocked(
      createCALRLockedEvent(admin, BigInt.fromI32(1000), BigInt.fromI32(500)),
    );
    // Distinct logIndex so the second activity gets its own id.
    const second = createCALRLockedEvent(
      admin,
      BigInt.fromI32(250),
      BigInt.fromI32(900),
    );
    second.logIndex = second.logIndex.plus(BigInt.fromI32(1));
    handleCALRLocked(second);

    assert.fieldEquals("CircleAdminCALR", ADMIN, "totalLocked", "1250");
    assert.fieldEquals("CircleAdminCALR", ADMIN, "lastLockExpiresAt", "900");
    assert.fieldEquals("CircleAdminCALR", ADMIN, "totalUnlocked", "0");
    assert.entityCount("CALRActivity", 2);
  });

  test("accumulates unlocks independently of locks", () => {
    const admin = Address.fromString(ADMIN);
    handleCALRLocked(
      createCALRLockedEvent(admin, BigInt.fromI32(1000), BigInt.fromI32(500)),
    );
    handleCALRUnlocked(createCALRUnlockedEvent(admin, BigInt.fromI32(400)));

    assert.fieldEquals("CircleAdminCALR", ADMIN, "totalLocked", "1000");
    assert.fieldEquals("CircleAdminCALR", ADMIN, "totalUnlocked", "400");
  });

  test("records revert with actual amount and snapshot shortfall detail", () => {
    const admin = Address.fromString(ADMIN);
    handleCALRLockReverted(
      createCALRLockRevertedEvent(
        BigInt.fromI32(77),
        admin,
        BigInt.fromI32(300),
        BigInt.fromI32(120),
      ),
    );

    // Aggregate counts only what actually left the bucket.
    assert.fieldEquals("CircleAdminCALR", ADMIN, "totalReverted", "120");

    const mock = newMockEvent();
    const activityId = mock.transaction.hash
      .concatI32(mock.logIndex.toI32())
      .toHexString();
    assert.fieldEquals("CALRActivity", activityId, "activityType", "LOCK_REVERTED");
    assert.fieldEquals("CALRActivity", activityId, "amount", "120");
    assert.fieldEquals("CALRActivity", activityId, "snapshotAmount", "300");
    assert.fieldEquals("CALRActivity", activityId, "orderId", "77");
  });

  test("claimable credit increments main-side rewards and logs activity", () => {
    const admin = Address.fromString(ADMIN);
    handleCircleAdminClaimableRewardsCredited(
      createClaimableCreditedEvent(admin, BigInt.fromI32(600)),
    );
    const second = createClaimableCreditedEvent(admin, BigInt.fromI32(150));
    second.logIndex = second.logIndex.plus(BigInt.fromI32(1));
    handleCircleAdminClaimableRewardsCredited(second);

    assert.fieldEquals("CircleAdminRewards", ADMIN, "claimableRewards", "750");

    const mock = newMockEvent();
    const activityId = mock.transaction.hash
      .concatI32(mock.logIndex.toI32())
      .toHexString();
    assert.fieldEquals(
      "CALRActivity",
      activityId,
      "activityType",
      "CLAIMABLE_CREDITED",
    );
  });
});
