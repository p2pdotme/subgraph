import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Orders } from "../../generated/schema";
import { OrderPlaced_orderStruct } from "../../generated/OrderFlowFacet/OrderFlowFacet";

export function loadOrders(key: Bytes, event: ethereum.Event): Orders {
  let order = Orders.load(key);

  if (!order) {
    order = new Orders(key);
    order.orderId = BigInt.fromI32(0);
    order.type = 0;
    order.status = 0;
    order.userAddress = Bytes.empty();
    order.usdcRecipientAddress = Bytes.empty();
    order.usdcAmount = BigInt.fromI32(0);
    order.fiatAmount = BigInt.fromI32(0);
    order.currency = "";
    order.assignedMerchants = [];
    order.isUserCompleted = false;
    order.userCompletedAt = BigInt.fromI32(0);
    order.completedAt = BigInt.fromI32(0);
    order.placedAt = BigInt.fromI32(0);
    order.acceptedAt = BigInt.fromI32(0);
    order.paidAt = BigInt.fromI32(0);
    order.cancelledAt = BigInt.fromI32(0);
    order.acceptedPCId = BigInt.fromI32(0);
    order.merchantAddress = Bytes.empty();
    order.circleId = BigInt.fromI32(0);
    order.pubkey = "";
    order.encUpi = "";
    order.userPubKey = "";
    order.encMerchantUpi = "";
    order.cancelledBy = Bytes.empty();
  }

  order.blockNumber = event.block.number;
  order.blockTimestamp = event.block.timestamp;
  order.transactionHash = event.transaction.hash;

  return order;
}

export const syncOrder = (
  orderId: BigInt,
  orderType: i32,
  status: i32,
  user: Bytes,
  recipientAddr: Bytes,
  amount: BigInt,
  fiatAmount: BigInt,
  currency: string,
  userCompleted: boolean,
  userCompletedTimestamp: BigInt,
  placedTimestamp: BigInt,
  completedTimestamp: BigInt,
  pubkey: string,
  encUpi: string,
  userPubKey: string,
  encMerchantUpi: string,
  circleId: BigInt,
  event: ethereum.Event
): void => {
  let _order = loadOrders(Bytes.fromByteArray(Bytes.fromBigInt(orderId)), event);

  _order.orderId = orderId;
  _order.type = orderType;
  _order.status = status;
  _order.userAddress = user;
  _order.usdcRecipientAddress = recipientAddr;
  _order.circleId = circleId;
  _order.usdcAmount = amount;
  _order.fiatAmount = fiatAmount;
  _order.currency = currency;

  _order.isUserCompleted = userCompleted;
  _order.userCompletedAt = userCompletedTimestamp;
  _order.placedAt = placedTimestamp;
  _order.completedAt = completedTimestamp;

  _order.pubkey = pubkey;
  _order.encUpi = encUpi;
  _order.userPubKey = userPubKey;
  _order.encMerchantUpi = encMerchantUpi;

  _order.blockNumber = event.block.number;
  _order.blockTimestamp = event.block.timestamp;
  _order.transactionHash = event.transaction.hash;

  _order.save();
};

