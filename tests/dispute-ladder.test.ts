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
  DisputeDecided,
  DisputeRaised,
  DisputeEscalated,
  DisputeSettled,
} from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import {
  handleDisputeDecided,
  handleDisputeRaised,
  handleDisputeEscalated,
  handleDisputeSettled,
} from "../src/order";

const CIRCLE = "0x000000000000000000000000000000000000000a";
const USER = "0x000000000000000000000000000000000000000b";
const OPS = "0x000000000000000000000000000000000000000c";
const ANYONE = "0x000000000000000000000000000000000000000d";
const ORDER_ID = BigInt.fromI32(7);

function orderKey(orderId: BigInt): string {
  return Bytes.fromByteArray(Bytes.fromBigInt(orderId)).toHexString();
}

function baseEvent(timestamp: i32): ethereum.Event {
  const mock = newMockEvent();
  mock.block.timestamp = BigInt.fromI32(timestamp);
  return mock;
}

function u256(v: BigInt): ethereum.Value {
  return ethereum.Value.fromUnsignedBigInt(v);
}

function raised(
  tier: i32,
  by: string,
  appealableAt: i32,
  ts: i32,
): DisputeRaised {
  const mock = baseEvent(ts);
  const e = new DisputeRaised(
    mock.address, mock.logIndex, mock.transactionLogIndex, mock.logType,
    mock.block, mock.transaction, mock.parameters, mock.receipt,
  );
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(new ethereum.EventParam("orderId", u256(ORDER_ID)));
  e.parameters.push(new ethereum.EventParam("tier", ethereum.Value.fromI32(tier)));
  e.parameters.push(new ethereum.EventParam("by", ethereum.Value.fromAddress(Address.fromString(by))));
  e.parameters.push(new ethereum.EventParam("appealableAt", u256(BigInt.fromI32(appealableAt))));
  return e;
}

function decided(
  tier: i32,
  faultType: i32,
  by: string,
  appealableUntil: i32,
  ts: i32,
): DisputeDecided {
  const mock = baseEvent(ts);
  const e = new DisputeDecided(
    mock.address, mock.logIndex, mock.transactionLogIndex, mock.logType,
    mock.block, mock.transaction, mock.parameters, mock.receipt,
  );
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(new ethereum.EventParam("orderId", u256(ORDER_ID)));
  e.parameters.push(new ethereum.EventParam("decisionTier", ethereum.Value.fromI32(tier)));
  e.parameters.push(new ethereum.EventParam("faultType", ethereum.Value.fromI32(faultType)));
  e.parameters.push(new ethereum.EventParam("by", ethereum.Value.fromAddress(Address.fromString(by))));
  e.parameters.push(new ethereum.EventParam("appealableUntil", u256(BigInt.fromI32(appealableUntil))));
  return e;
}

function escalated(
  fromTier: i32,
  toTier: i32,
  by: string,
  slaLapsed: boolean,
  ts: i32,
): DisputeEscalated {
  const mock = baseEvent(ts);
  const e = new DisputeEscalated(
    mock.address, mock.logIndex, mock.transactionLogIndex, mock.logType,
    mock.block, mock.transaction, mock.parameters, mock.receipt,
  );
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(new ethereum.EventParam("orderId", u256(ORDER_ID)));
  e.parameters.push(new ethereum.EventParam("fromTier", ethereum.Value.fromI32(fromTier)));
  e.parameters.push(new ethereum.EventParam("toTier", ethereum.Value.fromI32(toTier)));
  e.parameters.push(new ethereum.EventParam("by", ethereum.Value.fromAddress(Address.fromString(by))));
  e.parameters.push(new ethereum.EventParam("slaLapsed", ethereum.Value.fromBoolean(slaLapsed)));
  return e;
}

function settled(
  tier: i32,
  faultType: i32,
  decidedBy: string,
  finalizedBy: string,
  ts: i32,
): DisputeSettled {
  const mock = baseEvent(ts);
  const e = new DisputeSettled(
    mock.address, mock.logIndex, mock.transactionLogIndex, mock.logType,
    mock.block, mock.transaction, mock.parameters, mock.receipt,
  );
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(new ethereum.EventParam("orderId", u256(ORDER_ID)));
  e.parameters.push(new ethereum.EventParam("tier", ethereum.Value.fromI32(tier)));
  e.parameters.push(new ethereum.EventParam("faultType", ethereum.Value.fromI32(faultType)));
  e.parameters.push(new ethereum.EventParam("decidedBy", ethereum.Value.fromAddress(Address.fromString(decidedBy))));
  e.parameters.push(new ethereum.EventParam("finalizedBy", ethereum.Value.fromAddress(Address.fromString(finalizedBy))));
  return e;
}

function stepId(e: ethereum.Event): string {
  return e.transaction.hash.concatI32(e.logIndex.toI32()).toHexString();
}

function withLog(e: ethereum.Event, logIndex: i32): void {
  e.logIndex = BigInt.fromI32(logIndex);
}

describe("Dispute ladder on the order", () => {
  afterEach(() => {
    clearStore();
  });

  test("raise puts the dispute at tier 1 and starts the history", () => {
    const r = raised(1, USER, 500, 100);
    withLog(r, 1);
    handleDisputeRaised(r);
    const key = orderKey(ORDER_ID);
    assert.fieldEquals("Orders", key, "disputeTier", "1");
    assert.fieldEquals("Orders", key, "disputeAppealableUntil", "0");
    assert.fieldEquals("Orders", key, "disputeHistory", "[" + stepId(r) + "]");
    assert.fieldEquals("DisputeStep", stepId(r), "kind", "0");
    assert.fieldEquals("DisputeStep", stepId(r), "tier", "1");
    assert.fieldEquals("DisputeStep", stepId(r), "by", USER);
    assert.fieldEquals("DisputeStep", stepId(r), "deadline", "500");
    assert.fieldEquals("DisputeStep", stepId(r), "orderId", "7");
  });

  test("a tier-1 decision is pending on the order and appended to history", () => {
    const r = raised(1, USER, 500, 100);
    withLog(r, 1);
    const d = decided(1, 2, CIRCLE, 1000, 200);
    withLog(d, 2);
    handleDisputeRaised(r);
    handleDisputeDecided(d);
    const key = orderKey(ORDER_ID);
    assert.fieldEquals("Orders", key, "disputeTier", "1");
    assert.fieldEquals("Orders", key, "disputeAppealableUntil", "1000");
    assert.fieldEquals(
      "Orders", key, "disputeHistory",
      "[" + stepId(r) + ", " + stepId(d) + "]",
    );
    assert.fieldEquals("DisputeStep", stepId(d), "kind", "1");
    assert.fieldEquals("DisputeStep", stepId(d), "faultType", "2");
    assert.fieldEquals("DisputeStep", stepId(d), "by", CIRCLE);
    assert.fieldEquals("DisputeStep", stepId(d), "blockTimestamp", "200");
  });

  test("full climb 1 -> 2 -> 3 keeps every step in order", () => {
    const key = orderKey(ORDER_ID);
    const r = raised(1, USER, 500, 100);
    withLog(r, 1);
    const d1 = decided(1, 2, CIRCLE, 1000, 200);
    withLog(d1, 2);
    const e1 = escalated(1, 2, USER, false, 300);
    withLog(e1, 3);
    const e2 = escalated(2, 3, USER, true, 400);
    withLog(e2, 4);
    const d3 = decided(3, 1, OPS, 0, 500);
    withLog(d3, 5);
    const s3 = settled(3, 1, OPS, OPS, 500);
    withLog(s3, 6);

    handleDisputeRaised(r);
    handleDisputeDecided(d1);
    handleDisputeEscalated(e1);
    assert.fieldEquals("Orders", key, "disputeTier", "2");
    assert.fieldEquals("Orders", key, "disputeAppealableUntil", "0");

    handleDisputeEscalated(e2);
    assert.fieldEquals("Orders", key, "disputeTier", "3");

    handleDisputeDecided(d3);
    handleDisputeSettled(s3);
    assert.fieldEquals("Orders", key, "disputeTier", "3");
    assert.fieldEquals("Orders", key, "disputeAppealableUntil", "0");
    assert.fieldEquals("Orders", key, "disputeFinalizedByAddr", OPS);

    assert.entityCount("DisputeStep", 6);
    assert.fieldEquals(
      "Orders", key, "disputeHistory",
      "[" + [stepId(r), stepId(d1), stepId(e1), stepId(e2), stepId(d3), stepId(s3)].join(", ") + "]",
    );

    assert.fieldEquals("DisputeStep", stepId(e1), "kind", "2");
    assert.fieldEquals("DisputeStep", stepId(e1), "fromTier", "1");
    assert.fieldEquals("DisputeStep", stepId(e1), "tier", "2");
    assert.fieldEquals("DisputeStep", stepId(e1), "slaLapsed", "false");
    assert.fieldEquals("DisputeStep", stepId(e2), "fromTier", "2");
    assert.fieldEquals("DisputeStep", stepId(e2), "tier", "3");
    assert.fieldEquals("DisputeStep", stepId(e2), "slaLapsed", "true");
    assert.fieldEquals("DisputeStep", stepId(d3), "tier", "3");
    assert.fieldEquals("DisputeStep", stepId(d3), "deadline", "0");
    assert.fieldEquals("DisputeStep", stepId(s3), "kind", "3");
    assert.fieldEquals("DisputeStep", stepId(s3), "faultType", "1");
    assert.fieldEquals("DisputeStep", stepId(s3), "finalizedBy", OPS);
  });

  test("an unappealed tier-1 decision finalized by anyone records the finalizer", () => {
    const key = orderKey(ORDER_ID);
    const r = raised(1, USER, 500, 100);
    withLog(r, 1);
    const d = decided(1, 2, CIRCLE, 1000, 200);
    withLog(d, 2);
    const s = settled(1, 2, CIRCLE, ANYONE, 1100);
    withLog(s, 3);
    handleDisputeRaised(r);
    handleDisputeDecided(d);
    handleDisputeSettled(s);
    assert.fieldEquals("Orders", key, "disputeTier", "1");
    assert.fieldEquals("Orders", key, "disputeFinalizedByAddr", ANYONE);
    assert.fieldEquals("DisputeStep", stepId(s), "by", CIRCLE);
    assert.fieldEquals("DisputeStep", stepId(s), "finalizedBy", ANYONE);
    assert.fieldEquals(
      "Orders", key, "disputeHistory",
      "[" + stepId(r) + ", " + stepId(d) + ", " + stepId(s) + "]",
    );
  });
});
