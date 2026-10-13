import { newMockEvent } from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CancelledOrders,
  OrderCancelledBy,
} from "../generated/OrderFlowFacet/OrderFlowFacet";
import { OrderCompleted } from "../generated/OrderFlowHelper/OrderFlowHelper";
import { OrderDispute } from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import {
  CancelledOrders as LegacyCancelledOrders,
  OrderCancelledBy as LegacyOrderCancelledBy,
  OrderCompleted as LegacyOrderCompleted,
} from "../generated/LegacyOrderFlowFacet/LegacyOrderFlowFacet";
import {
  OrderDispute as LegacyOrderDisputeV2,
  OrderDispute1 as LegacyOrderDispute,
} from "../generated/LegacyOrderProcessorFacet/LegacyOrderProcessorFacet";

// Builders for the order events that share the 22-field Order tuple
// (OrderProcessorStorage.Order), and the pre-COT legacy events whose tuple
// has 21 fields (no circleId). Module scope only: AssemblyScript has no
// closures.

export const CURRENCY_INR = Bytes.fromHexString(
  "0x494e520000000000000000000000000000000000000000000000000000000000",
);

export class OrderFields {
  id: i32 = 1;
  orderType: i32 = 1; // SELL
  status: i32 = 0;
  disputeStatus: i32 = 0;
  amount: i32 = 100000000;
  completedTimestamp: i32 = 0;
  circleId: i32 = 2;
  merchant: Address = Address.zero();
  user: Address = Address.zero();
}

function orderTuple(f: OrderFields, legacy: boolean = false): ethereum.Tuple {
  const dispute = new ethereum.Tuple();
  dispute.push(ethereum.Value.fromI32(0)); // raisedBy
  dispute.push(ethereum.Value.fromI32(f.disputeStatus));
  dispute.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero())); // redactTransId
  dispute.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero())); // accountNumber

  const t = new ethereum.Tuple();
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.amount))); // 0 amount
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))); // 1 fiatAmount
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))); // 2 placedTimestamp
  t.push(
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.completedTimestamp)),
  ); // 3 completedTimestamp
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero())); // 4 userCompletedTimestamp
  t.push(ethereum.Value.fromAddress(f.merchant)); // 5 acceptedMerchant
  t.push(ethereum.Value.fromAddress(f.user)); // 6 user
  t.push(ethereum.Value.fromAddress(f.user)); // 7 recipientAddr
  t.push(ethereum.Value.fromString("")); // 8 pubkey
  t.push(ethereum.Value.fromString("")); // 9 encUpi
  t.push(ethereum.Value.fromBoolean(false)); // 10 userCompleted
  t.push(ethereum.Value.fromI32(f.status)); // 11 status
  t.push(ethereum.Value.fromI32(f.orderType)); // 12 orderType
  t.push(ethereum.Value.fromTuple(dispute)); // 13 disputeInfo
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))); // 14 id
  t.push(ethereum.Value.fromString("")); // 15 userPubKey
  t.push(ethereum.Value.fromString("")); // 16 encMerchantUpi
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero())); // 17 acceptedAccountNo
  t.push(ethereum.Value.fromUnsignedBigIntArray(new Array<BigInt>())); // 18 assignedAccountNos
  t.push(ethereum.Value.fromFixedBytes(CURRENCY_INR)); // 19 currency
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero())); // 20 preferredPaymentChannelConfigId
  if (!legacy) {
    t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.circleId))); // 21 circleId
  }
  return t;
}

let nextLogIndex = 0;

function base<T extends ethereum.Event>(timestamp: i32): T {
  const e = changetype<T>(newMockEvent());
  e.block.timestamp = BigInt.fromI32(timestamp);
  e.logIndex = BigInt.fromI32(nextLogIndex++);
  e.parameters = new Array<ethereum.EventParam>();
  return e;
}

function p(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

export function orderCompleted(f: OrderFields, timestamp: i32): OrderCompleted {
  const e = base<OrderCompleted>(timestamp);
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("user", ethereum.Value.fromAddress(f.user)));
  e.parameters.push(
    p(
      "completedTimestamp",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.completedTimestamp)),
    ),
  );
  e.parameters.push(p("_order", ethereum.Value.fromTuple(orderTuple(f))));
  return e;
}

export function cancelledOrders(
  f: OrderFields,
  timestamp: i32,
): CancelledOrders {
  const e = base<CancelledOrders>(timestamp);
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("_order", ethereum.Value.fromTuple(orderTuple(f))));
  return e;
}

export function orderCancelledBy(
  f: OrderFields,
  by: Address,
  timestamp: i32,
): OrderCancelledBy {
  const e = base<OrderCancelledBy>(timestamp);
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("cancelledBy", ethereum.Value.fromAddress(by)));
  return e;
}

export function orderDispute(
  f: OrderFields,
  faultType: i32,
  by: Address,
  timestamp: i32,
): OrderDispute {
  const e = base<OrderDispute>(timestamp);
  e.parameters.push(p("by", ethereum.Value.fromAddress(by)));
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("_order", ethereum.Value.fromTuple(orderTuple(f))));
  e.parameters.push(p("faultType", ethereum.Value.fromI32(faultType)));
  return e;
}

export function legacyOrderCompleted(
  f: OrderFields,
  timestamp: i32,
): LegacyOrderCompleted {
  const e = base<LegacyOrderCompleted>(timestamp);
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("user", ethereum.Value.fromAddress(f.user)));
  e.parameters.push(
    p(
      "completedTimestamp",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.completedTimestamp)),
    ),
  );
  e.parameters.push(p("_order", ethereum.Value.fromTuple(orderTuple(f, true))));
  return e;
}

export function legacyCancelledOrders(
  f: OrderFields,
  timestamp: i32,
): LegacyCancelledOrders {
  const e = base<LegacyCancelledOrders>(timestamp);
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("_order", ethereum.Value.fromTuple(orderTuple(f, true))));
  return e;
}

export function legacyOrderCancelledBy(
  f: OrderFields,
  by: Address,
  timestamp: i32,
): LegacyOrderCancelledBy {
  const e = base<LegacyOrderCancelledBy>(timestamp);
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("cancelledBy", ethereum.Value.fromAddress(by)));
  return e;
}

// Pre-faultType OrderDispute (adminSettleDispute(orderId, bool userFault))
export function legacyOrderDispute(
  f: OrderFields,
  by: Address,
  timestamp: i32,
): LegacyOrderDispute {
  const e = base<LegacyOrderDispute>(timestamp);
  e.parameters.push(p("by", ethereum.Value.fromAddress(by)));
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("_order", ethereum.Value.fromTuple(orderTuple(f, true))));
  return e;
}

export function legacyOrderDisputeV2(
  f: OrderFields,
  faultType: i32,
  by: Address,
  timestamp: i32,
): LegacyOrderDisputeV2 {
  const e = base<LegacyOrderDisputeV2>(timestamp);
  e.parameters.push(p("by", ethereum.Value.fromAddress(by)));
  e.parameters.push(
    p("orderId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(f.id))),
  );
  e.parameters.push(p("_order", ethereum.Value.fromTuple(orderTuple(f, true))));
  e.parameters.push(p("faultType", ethereum.Value.fromI32(faultType)));
  return e;
}
