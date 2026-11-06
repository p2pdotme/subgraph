import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { OrderDispute } from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import { handleOrderDisputeWithFaultType } from "../src/order";

// OrderDispute(by, orderId, order, faultType) is what #464 emits on raise
// (OrderProcessorFacet.sol:245, by = raiser) and on settle (:702, by = the
// decider, while finalizeDispute itself may be sent by anyone).
const DECIDER = "0x000000000000000000000000000000000000000c";
const FINALIZER = "0x000000000000000000000000000000000000000d";
const MERCHANT = "0x000000000000000000000000000000000000000e";
const USER = "0x000000000000000000000000000000000000000b";
const ORDER_ID = BigInt.fromI32(7);

function orderKey(): string {
  return Bytes.fromByteArray(Bytes.fromBigInt(ORDER_ID)).toHexString();
}

function u256(v: i32): ethereum.Value {
  return ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(v));
}

function orderDispute(by: string, disputeStatus: i32, txFrom: string): OrderDispute {
  const mock = newMockEvent();
  mock.block.timestamp = BigInt.fromI32(1_000);
  mock.transaction.from = Address.fromString(txFrom);
  const e = new OrderDispute(
    mock.address, mock.logIndex, mock.transactionLogIndex, mock.logType,
    mock.block, mock.transaction, mock.parameters, mock.receipt,
  );

  const disputeInfo = new ethereum.Tuple();
  disputeInfo.push(ethereum.Value.fromI32(1)); // raisedBy
  disputeInfo.push(ethereum.Value.fromI32(disputeStatus));
  disputeInfo.push(u256(0)); // redactTransId
  disputeInfo.push(u256(0)); // accountNumber

  const order = new ethereum.Tuple();
  order.push(u256(100)); // amount
  order.push(u256(9_000)); // fiatAmount
  order.push(u256(900)); // placedTimestamp
  order.push(u256(950)); // completedTimestamp
  order.push(u256(0)); // userCompletedTimestamp
  order.push(ethereum.Value.fromAddress(Address.fromString(MERCHANT)));
  order.push(ethereum.Value.fromAddress(Address.fromString(USER)));
  order.push(ethereum.Value.fromAddress(Address.fromString(USER)));
  order.push(ethereum.Value.fromString("")); // pubkey
  order.push(ethereum.Value.fromString("")); // encUpi
  order.push(ethereum.Value.fromBoolean(false));
  order.push(ethereum.Value.fromI32(3)); // status
  order.push(ethereum.Value.fromI32(0)); // orderType
  order.push(ethereum.Value.fromTuple(disputeInfo));
  order.push(u256(7)); // id
  order.push(ethereum.Value.fromString("")); // userPubKey
  order.push(ethereum.Value.fromString("")); // encMerchantUpi
  order.push(u256(0)); // acceptedAccountNo
  order.push(ethereum.Value.fromUnsignedBigIntArray([]));
  order.push(ethereum.Value.fromFixedBytes(Bytes.fromHexString("0x494e520000000000000000000000000000000000000000000000000000000000")));
  order.push(u256(0)); // preferredPaymentChannelConfigId
  order.push(u256(0)); // circleId

  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(new ethereum.EventParam("by", ethereum.Value.fromAddress(Address.fromString(by))));
  e.parameters.push(new ethereum.EventParam("orderId", u256(7)));
  e.parameters.push(new ethereum.EventParam("_order", ethereum.Value.fromTuple(order)));
  e.parameters.push(new ethereum.EventParam("faultType", ethereum.Value.fromI32(1)));
  return e;
}

describe("OrderDispute (fault-type variant)", () => {
  afterEach(() => {
    clearStore();
  });

  test("settled: settler is the decider in `by`, not whoever sent the tx", () => {
    handleOrderDisputeWithFaultType(orderDispute(DECIDER, 2, FINALIZER));
    assert.fieldEquals("Orders", orderKey(), "disputeSettledByAddr", DECIDER);
  });

  test("raised with no DisputeRaised before it (pre-upgrade): tier reads as 1", () => {
    handleOrderDisputeWithFaultType(orderDispute(USER, 1, USER));
    assert.fieldEquals("Orders", orderKey(), "disputeTier", "1");
  });
});
