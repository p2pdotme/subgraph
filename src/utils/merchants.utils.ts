import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AssignedMerchants,
  CircleMerchant,
  MerchantPaymentChannels,
} from "../../generated/schema";

export function loadAssignedMerchants(
  key: Bytes,
  event: ethereum.Event
): AssignedMerchants {
  let assignedMerchant = AssignedMerchants.load(key);

  if (!assignedMerchant) {
    assignedMerchant = new AssignedMerchants(key);
  }

  assignedMerchant.blockNumber = event.block.number;
  assignedMerchant.blockTimestamp = event.block.timestamp;
  assignedMerchant.transactionHash = event.transaction.hash;

  return assignedMerchant;
}

export function loadCircleMerchant(
  key: Bytes,
  event: ethereum.Event
): CircleMerchant {
  let circleMerchant = CircleMerchant.load(key);
  if (!circleMerchant) {
    circleMerchant = new CircleMerchant(key);
    circleMerchant.merchant = key.toHexString();
    circleMerchant.telegramId = "";
    circleMerchant.circleId = BigInt.zero();
    circleMerchant.circle = Bytes.fromI32(0);
    circleMerchant.orders = [];
    circleMerchant.stakedAmount = BigInt.zero();
    circleMerchant.delegatedStakedAmount = BigInt.zero();
    circleMerchant.isOnline = false;
    circleMerchant.isBlacklisted = false;
    circleMerchant.isOngoingOrder = false;
    circleMerchant.onlineAt = BigInt.zero();
    circleMerchant.offlineAt = BigInt.zero();
    circleMerchant.startedAt = BigInt.zero();
    circleMerchant.currency = Bytes.empty();
    circleMerchant.paymentChannels = [];
  }

  circleMerchant.blockNumber = event.block.number;
  circleMerchant.blockTimestamp = event.block.timestamp;
  circleMerchant.transactionHash = event.transaction.hash;

  return circleMerchant;
}

export function loadMerchantPaymentChannels(
  key: Bytes,
  event: ethereum.Event
): MerchantPaymentChannels {
  let merchantPaymentChannel = MerchantPaymentChannels.load(key);
  if (!merchantPaymentChannel) {
    merchantPaymentChannel = new MerchantPaymentChannels(key);
    merchantPaymentChannel.pcConfigId = BigInt.zero();
    merchantPaymentChannel.accountNo = BigInt.zero();
    merchantPaymentChannel.label = "";
    merchantPaymentChannel.isActive = false;
    merchantPaymentChannel.status = 0;
    merchantPaymentChannel.isMonthlyVolumeUnlimited = false;
  }

  merchantPaymentChannel.blockNumber = event.block.number;
  merchantPaymentChannel.blockTimestamp = event.block.timestamp;
  merchantPaymentChannel.transactionHash = event.transaction.hash;

  return merchantPaymentChannel;
}
