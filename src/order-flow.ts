import {
  AdditionalOrderDetails as AdditionalOrderDetailsEvent,
  CancelledOrders as CancelledOrdersEvent,
  MerchantAssignedNewOrder as MerchantAssignedNewOrderEvent,
  MerchantReAssignedNewOrder as MerchantReAssignedNewOrderEvent,
  MerchantVolume as MerchantVolumeEvent,
  MerchantsReAssigned as MerchantsReAssignedEvent,
  OrderCancelledBy as OrderCancelledByEvent,
  OrderPlaced as OrderPlacedEvent,
  SellOrderUpiSet as SellOrderUpiSetEvent
} from "../generated/OrderFlow/OrderFlow"
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
} from "../generated/schema"

export function handleAdditionalOrderDetails(
  event: AdditionalOrderDetailsEvent
): void {
  let entity = new AdditionalOrderDetails(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId
  entity.details_fixedFeePaid = event.params.details.fixedFeePaid
  entity.details_tipsPaid = event.params.details.tipsPaid
  entity.details_acceptedTimestamp = event.params.details.acceptedTimestamp
  entity.details_paidTimestamp = event.params.details.paidTimestamp
  entity.details_reserved2 = event.params.details.reserved2
  entity.details_actualUsdtAmount = event.params.details.actualUsdtAmount
  entity.details_actualFiatAmount = event.params.details.actualFiatAmount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleCancelledOrders(event: CancelledOrdersEvent): void {
  let entity = new CancelledOrders(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId
  entity._order_amount = event.params._order.amount
  entity._order_fiatAmount = event.params._order.fiatAmount
  entity._order_placedTimestamp = event.params._order.placedTimestamp
  entity._order_completedTimestamp = event.params._order.completedTimestamp
  entity._order_userCompletedTimestamp =
    event.params._order.userCompletedTimestamp
  entity._order_acceptedMerchant = event.params._order.acceptedMerchant
  entity._order_user = event.params._order.user
  entity._order_recipientAddr = event.params._order.recipientAddr
  entity._order_pubkey = event.params._order.pubkey
  entity._order_encUpi = event.params._order.encUpi
  entity._order_userCompleted = event.params._order.userCompleted
  entity._order_status = event.params._order.status
  entity._order_orderType = event.params._order.orderType
  entity._order_disputeInfo_raisedBy = event.params._order.disputeInfo.raisedBy
  entity._order_disputeInfo_status = event.params._order.disputeInfo.status
  entity._order_disputeInfo_redactTransId =
    event.params._order.disputeInfo.redactTransId
  entity._order_disputeInfo_accountNumber =
    event.params._order.disputeInfo.accountNumber
  entity._order_id = event.params._order.id
  entity._order_userPubKey = event.params._order.userPubKey
  entity._order_encMerchantUpi = event.params._order.encMerchantUpi
  entity._order_acceptedAccountNo = event.params._order.acceptedAccountNo
  entity._order_assignedAccountNos = event.params._order.assignedAccountNos
  entity._order_currency = event.params._order.currency
  entity._order_preferredPaymentChannelConfigId =
    event.params._order.preferredPaymentChannelConfigId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMerchantAssignedNewOrder(
  event: MerchantAssignedNewOrderEvent
): void {
  let entity = new MerchantAssignedNewOrder(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId
  entity.merchant = event.params.merchant
  entity._order_amount = event.params._order.amount
  entity._order_fiatAmount = event.params._order.fiatAmount
  entity._order_placedTimestamp = event.params._order.placedTimestamp
  entity._order_completedTimestamp = event.params._order.completedTimestamp
  entity._order_userCompletedTimestamp =
    event.params._order.userCompletedTimestamp
  entity._order_acceptedMerchant = event.params._order.acceptedMerchant
  entity._order_user = event.params._order.user
  entity._order_recipientAddr = event.params._order.recipientAddr
  entity._order_pubkey = event.params._order.pubkey
  entity._order_encUpi = event.params._order.encUpi
  entity._order_userCompleted = event.params._order.userCompleted
  entity._order_status = event.params._order.status
  entity._order_orderType = event.params._order.orderType
  entity._order_disputeInfo_raisedBy = event.params._order.disputeInfo.raisedBy
  entity._order_disputeInfo_status = event.params._order.disputeInfo.status
  entity._order_disputeInfo_redactTransId =
    event.params._order.disputeInfo.redactTransId
  entity._order_disputeInfo_accountNumber =
    event.params._order.disputeInfo.accountNumber
  entity._order_id = event.params._order.id
  entity._order_userPubKey = event.params._order.userPubKey
  entity._order_encMerchantUpi = event.params._order.encMerchantUpi
  entity._order_acceptedAccountNo = event.params._order.acceptedAccountNo
  entity._order_assignedAccountNos = event.params._order.assignedAccountNos
  entity._order_currency = event.params._order.currency
  entity._order_preferredPaymentChannelConfigId =
    event.params._order.preferredPaymentChannelConfigId
  entity.accountNo = event.params.accountNo

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMerchantReAssignedNewOrder(
  event: MerchantReAssignedNewOrderEvent
): void {
  let entity = new MerchantReAssignedNewOrder(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId
  entity.merchant = event.params.merchant
  entity._order_amount = event.params._order.amount
  entity._order_fiatAmount = event.params._order.fiatAmount
  entity._order_placedTimestamp = event.params._order.placedTimestamp
  entity._order_completedTimestamp = event.params._order.completedTimestamp
  entity._order_userCompletedTimestamp =
    event.params._order.userCompletedTimestamp
  entity._order_acceptedMerchant = event.params._order.acceptedMerchant
  entity._order_user = event.params._order.user
  entity._order_recipientAddr = event.params._order.recipientAddr
  entity._order_pubkey = event.params._order.pubkey
  entity._order_encUpi = event.params._order.encUpi
  entity._order_userCompleted = event.params._order.userCompleted
  entity._order_status = event.params._order.status
  entity._order_orderType = event.params._order.orderType
  entity._order_disputeInfo_raisedBy = event.params._order.disputeInfo.raisedBy
  entity._order_disputeInfo_status = event.params._order.disputeInfo.status
  entity._order_disputeInfo_redactTransId =
    event.params._order.disputeInfo.redactTransId
  entity._order_disputeInfo_accountNumber =
    event.params._order.disputeInfo.accountNumber
  entity._order_id = event.params._order.id
  entity._order_userPubKey = event.params._order.userPubKey
  entity._order_encMerchantUpi = event.params._order.encMerchantUpi
  entity._order_acceptedAccountNo = event.params._order.acceptedAccountNo
  entity._order_assignedAccountNos = event.params._order.assignedAccountNos
  entity._order_currency = event.params._order.currency
  entity._order_preferredPaymentChannelConfigId =
    event.params._order.preferredPaymentChannelConfigId
  entity.accountNo = event.params.accountNo

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMerchantVolume(event: MerchantVolumeEvent): void {
  let entity = new MerchantVolume(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.merchant = event.params.merchant
  entity.accountNo = event.params.accountNo
  entity.dailyVolume = event.params.dailyVolume
  entity.monthlyVolume = event.params.monthlyVolume

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMerchantsReAssigned(
  event: MerchantsReAssignedEvent
): void {
  let entity = new MerchantsReAssigned(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOrderCancelledBy(event: OrderCancelledByEvent): void {
  let entity = new OrderCancelledBy(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId
  entity.cancelledBy = event.params.cancelledBy

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOrderPlaced(event: OrderPlacedEvent): void {
  let entity = new OrderPlaced(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId
  entity.user = event.params.user
  entity.merchant = event.params.merchant
  entity.amount = event.params.amount
  entity.orderType = event.params.orderType
  entity.placedTimestamp = event.params.placedTimestamp
  entity._order_amount = event.params._order.amount
  entity._order_fiatAmount = event.params._order.fiatAmount
  entity._order_placedTimestamp = event.params._order.placedTimestamp
  entity._order_completedTimestamp = event.params._order.completedTimestamp
  entity._order_userCompletedTimestamp =
    event.params._order.userCompletedTimestamp
  entity._order_acceptedMerchant = event.params._order.acceptedMerchant
  entity._order_user = event.params._order.user
  entity._order_recipientAddr = event.params._order.recipientAddr
  entity._order_pubkey = event.params._order.pubkey
  entity._order_encUpi = event.params._order.encUpi
  entity._order_userCompleted = event.params._order.userCompleted
  entity._order_status = event.params._order.status
  entity._order_orderType = event.params._order.orderType
  entity._order_disputeInfo_raisedBy = event.params._order.disputeInfo.raisedBy
  entity._order_disputeInfo_status = event.params._order.disputeInfo.status
  entity._order_disputeInfo_redactTransId =
    event.params._order.disputeInfo.redactTransId
  entity._order_disputeInfo_accountNumber =
    event.params._order.disputeInfo.accountNumber
  entity._order_id = event.params._order.id
  entity._order_userPubKey = event.params._order.userPubKey
  entity._order_encMerchantUpi = event.params._order.encMerchantUpi
  entity._order_acceptedAccountNo = event.params._order.acceptedAccountNo
  entity._order_assignedAccountNos = event.params._order.assignedAccountNos
  entity._order_currency = event.params._order.currency
  entity._order_preferredPaymentChannelConfigId =
    event.params._order.preferredPaymentChannelConfigId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSellOrderUpiSet(event: SellOrderUpiSetEvent): void {
  let entity = new SellOrderUpiSet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.orderId = event.params.orderId
  entity.user = event.params.user
  entity._order_amount = event.params._order.amount
  entity._order_fiatAmount = event.params._order.fiatAmount
  entity._order_placedTimestamp = event.params._order.placedTimestamp
  entity._order_completedTimestamp = event.params._order.completedTimestamp
  entity._order_userCompletedTimestamp =
    event.params._order.userCompletedTimestamp
  entity._order_acceptedMerchant = event.params._order.acceptedMerchant
  entity._order_user = event.params._order.user
  entity._order_recipientAddr = event.params._order.recipientAddr
  entity._order_pubkey = event.params._order.pubkey
  entity._order_encUpi = event.params._order.encUpi
  entity._order_userCompleted = event.params._order.userCompleted
  entity._order_status = event.params._order.status
  entity._order_orderType = event.params._order.orderType
  entity._order_disputeInfo_raisedBy = event.params._order.disputeInfo.raisedBy
  entity._order_disputeInfo_status = event.params._order.disputeInfo.status
  entity._order_disputeInfo_redactTransId =
    event.params._order.disputeInfo.redactTransId
  entity._order_disputeInfo_accountNumber =
    event.params._order.disputeInfo.accountNumber
  entity._order_id = event.params._order.id
  entity._order_userPubKey = event.params._order.userPubKey
  entity._order_encMerchantUpi = event.params._order.encMerchantUpi
  entity._order_acceptedAccountNo = event.params._order.acceptedAccountNo
  entity._order_assignedAccountNos = event.params._order.assignedAccountNos
  entity._order_currency = event.params._order.currency
  entity._order_preferredPaymentChannelConfigId =
    event.params._order.preferredPaymentChannelConfigId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
