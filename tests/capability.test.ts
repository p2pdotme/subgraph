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
  PermissionGranted,
  PermissionRevoked,
} from "../generated/CapabilityFacet/CapabilityFacet";
import {
  handlePermissionGranted,
  handlePermissionRevoked,
} from "../src/capability";
import { circleAccountId } from "../src/lib";

// Values from the event that halted indexing at block 52506326.
const ACCOUNT = "0x6c1cd62701c3e13facb9e5948ffb9b00d98ec583";
const SELECTOR = "0x66b7467b";

function createPermissionGrantedEvent(
  circleId: i32,
  account: string,
  selector: string,
  name: string,
): PermissionGranted {
  const mock = newMockEvent();
  const event = new PermissionGranted(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "circleId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(circleId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "account",
      ethereum.Value.fromAddress(Address.fromString(account)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "selector",
      ethereum.Value.fromFixedBytes(Bytes.fromHexString(selector)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString(name)),
  );
  return event;
}

function createPermissionRevokedEvent(
  circleId: i32,
  account: string,
  selector: string,
): PermissionRevoked {
  const mock = newMockEvent();
  const event = new PermissionRevoked(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "circleId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(circleId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "account",
      ethereum.Value.fromAddress(Address.fromString(account)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "selector",
      ethereum.Value.fromFixedBytes(Bytes.fromHexString(selector)),
    ),
  );
  return event;
}

function idOf(circleId: i32, account: string): string {
  return circleAccountId(
    BigInt.fromI32(circleId),
    Address.fromString(account),
  ).toHexString();
}

describe("CirclePermission id", () => {
  afterEach(() => {
    clearStore();
  });

  test("every circleId uses the UTF-8 bytes of the key", () => {
    // 1-digit and 3-digit ids used to take a junk Bytes.fromHexString path
    // (circle 1 -> 0x01006c1c...); now all digit counts share one format.
    assert.stringEquals(
      idOf(1, ACCOUNT),
      Bytes.fromUTF8(`1-${ACCOUNT}`).toHexString(),
    );
    assert.stringEquals(
      idOf(20, ACCOUNT),
      Bytes.fromUTF8(`20-${ACCOUNT}`).toHexString(),
    );
    assert.stringEquals(
      idOf(123, ACCOUNT),
      Bytes.fromUTF8(`123-${ACCOUNT}`).toHexString(),
    );
  });

  test("grant for circle 20 indexes instead of aborting", () => {
    handlePermissionGranted(
      createPermissionGrantedEvent(20, ACCOUNT, SELECTOR, "supreme"),
    );

    const id = idOf(20, ACCOUNT);
    assert.entityCount("CirclePermission", 1);
    assert.fieldEquals("CirclePermission", id, "circleId", "20");
    assert.fieldEquals("CirclePermission", id, "account", ACCOUNT);
    assert.fieldEquals("CirclePermission", id, "name", "supreme");
    assert.fieldEquals("CirclePermission", id, "selectors", `[${SELECTOR}]`);

    handlePermissionRevoked(createPermissionRevokedEvent(20, ACCOUNT, SELECTOR));
    assert.entityCount("CirclePermission", 1);
    assert.fieldEquals("CirclePermission", id, "selectors", "[]");
  });

  test("grant + revoke for circle 5 reuse one row", () => {
    handlePermissionGranted(
      createPermissionGrantedEvent(5, ACCOUNT, SELECTOR, "ops"),
    );
    handlePermissionRevoked(createPermissionRevokedEvent(5, ACCOUNT, SELECTOR));

    const id = idOf(5, ACCOUNT);
    assert.entityCount("CirclePermission", 1);
    assert.fieldEquals("CirclePermission", id, "selectors", "[]");
  });
});
