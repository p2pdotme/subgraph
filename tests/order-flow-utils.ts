import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  AdditionalOrderDetails,
  CancelledOrders,
  MerchantAssignedNewOrder,
  MerchantReAssignedNewOrder,
  MerchantVolume,
  MerchantsReAssigned,
  OrderCancelledBy,
  OrderPlaced,
  SellOrderUpiSet
} from "../generated/OrderFlow/OrderFlow"

export function createAdditionalOrderDetailsEvent(
  orderId: BigInt,
  details: ethereum.Tuple
): AdditionalOrderDetails {
  let additionalOrderDetailsEvent = changetype<AdditionalOrderDetails>(
    newMockEvent()
  )

  additionalOrderDetailsEvent.parameters = new Array()

  additionalOrderDetailsEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  additionalOrderDetailsEvent.parameters.push(
    new ethereum.EventParam("details", ethereum.Value.fromTuple(details))
  )

  return additionalOrderDetailsEvent
}

export function createCancelledOrdersEvent(
  orderId: BigInt,
  _order: ethereum.Tuple
): CancelledOrders {
  let cancelledOrdersEvent = changetype<CancelledOrders>(newMockEvent())

  cancelledOrdersEvent.parameters = new Array()

  cancelledOrdersEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  cancelledOrdersEvent.parameters.push(
    new ethereum.EventParam("_order", ethereum.Value.fromTuple(_order))
  )

  return cancelledOrdersEvent
}

export function createMerchantAssignedNewOrderEvent(
  orderId: BigInt,
  merchant: Address,
  _order: ethereum.Tuple,
  accountNo: BigInt
): MerchantAssignedNewOrder {
  let merchantAssignedNewOrderEvent = changetype<MerchantAssignedNewOrder>(
    newMockEvent()
  )

  merchantAssignedNewOrderEvent.parameters = new Array()

  merchantAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  merchantAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(merchant))
  )
  merchantAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam("_order", ethereum.Value.fromTuple(_order))
  )
  merchantAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam(
      "accountNo",
      ethereum.Value.fromUnsignedBigInt(accountNo)
    )
  )

  return merchantAssignedNewOrderEvent
}

export function createMerchantReAssignedNewOrderEvent(
  orderId: BigInt,
  merchant: Address,
  _order: ethereum.Tuple,
  accountNo: BigInt
): MerchantReAssignedNewOrder {
  let merchantReAssignedNewOrderEvent = changetype<MerchantReAssignedNewOrder>(
    newMockEvent()
  )

  merchantReAssignedNewOrderEvent.parameters = new Array()

  merchantReAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  merchantReAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(merchant))
  )
  merchantReAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam("_order", ethereum.Value.fromTuple(_order))
  )
  merchantReAssignedNewOrderEvent.parameters.push(
    new ethereum.EventParam(
      "accountNo",
      ethereum.Value.fromUnsignedBigInt(accountNo)
    )
  )

  return merchantReAssignedNewOrderEvent
}

export function createMerchantVolumeEvent(
  merchant: Address,
  accountNo: BigInt,
  dailyVolume: BigInt,
  monthlyVolume: BigInt
): MerchantVolume {
  let merchantVolumeEvent = changetype<MerchantVolume>(newMockEvent())

  merchantVolumeEvent.parameters = new Array()

  merchantVolumeEvent.parameters.push(
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(merchant))
  )
  merchantVolumeEvent.parameters.push(
    new ethereum.EventParam(
      "accountNo",
      ethereum.Value.fromUnsignedBigInt(accountNo)
    )
  )
  merchantVolumeEvent.parameters.push(
    new ethereum.EventParam(
      "dailyVolume",
      ethereum.Value.fromUnsignedBigInt(dailyVolume)
    )
  )
  merchantVolumeEvent.parameters.push(
    new ethereum.EventParam(
      "monthlyVolume",
      ethereum.Value.fromUnsignedBigInt(monthlyVolume)
    )
  )

  return merchantVolumeEvent
}

export function createMerchantsReAssignedEvent(
  orderId: BigInt
): MerchantsReAssigned {
  let merchantsReAssignedEvent = changetype<MerchantsReAssigned>(newMockEvent())

  merchantsReAssignedEvent.parameters = new Array()

  merchantsReAssignedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )

  return merchantsReAssignedEvent
}

export function createOrderCancelledByEvent(
  orderId: BigInt,
  cancelledBy: Address
): OrderCancelledBy {
  let orderCancelledByEvent = changetype<OrderCancelledBy>(newMockEvent())

  orderCancelledByEvent.parameters = new Array()

  orderCancelledByEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  orderCancelledByEvent.parameters.push(
    new ethereum.EventParam(
      "cancelledBy",
      ethereum.Value.fromAddress(cancelledBy)
    )
  )

  return orderCancelledByEvent
}

export function createOrderPlacedEvent(
  orderId: BigInt,
  user: Address,
  merchant: Address,
  amount: BigInt,
  orderType: i32,
  placedTimestamp: BigInt,
  _order: ethereum.Tuple
): OrderPlaced {
  let orderPlacedEvent = changetype<OrderPlaced>(newMockEvent())

  orderPlacedEvent.parameters = new Array()

  orderPlacedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  orderPlacedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  orderPlacedEvent.parameters.push(
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(merchant))
  )
  orderPlacedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  orderPlacedEvent.parameters.push(
    new ethereum.EventParam(
      "orderType",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(orderType))
    )
  )
  orderPlacedEvent.parameters.push(
    new ethereum.EventParam(
      "placedTimestamp",
      ethereum.Value.fromUnsignedBigInt(placedTimestamp)
    )
  )
  orderPlacedEvent.parameters.push(
    new ethereum.EventParam("_order", ethereum.Value.fromTuple(_order))
  )

  return orderPlacedEvent
}

export function createSellOrderUpiSetEvent(
  orderId: BigInt,
  user: Address,
  _order: ethereum.Tuple
): SellOrderUpiSet {
  let sellOrderUpiSetEvent = changetype<SellOrderUpiSet>(newMockEvent())

  sellOrderUpiSetEvent.parameters = new Array()

  sellOrderUpiSetEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  sellOrderUpiSetEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  sellOrderUpiSetEvent.parameters.push(
    new ethereum.EventParam("_order", ethereum.Value.fromTuple(_order))
  )

  return sellOrderUpiSetEvent
}
