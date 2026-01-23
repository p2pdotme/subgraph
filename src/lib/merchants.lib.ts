import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AssignedMerchants,
  CircleMerchant,
  MerchantPaymentChannels,
  MerchantVolumeByMonth,
  PaymentChannelMigration,
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
    // Order metrics
    circleMerchant.totalOrdersCount = BigInt.zero();
    circleMerchant.completedOrdersCount = BigInt.zero();
    circleMerchant.cancelledOrdersCount = BigInt.zero();
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
    merchantPaymentChannel.fiatBalance = BigInt.zero();
  }

  merchantPaymentChannel.blockNumber = event.block.number;
  merchantPaymentChannel.blockTimestamp = event.block.timestamp;
  merchantPaymentChannel.transactionHash = event.transaction.hash;

  return merchantPaymentChannel;
}

export function loadMerchantVolumeByMonth(
  key: Bytes,
  event: ethereum.Event
): MerchantVolumeByMonth {
  let merchantVolumeByMonth = MerchantVolumeByMonth.load(key);
  if (!merchantVolumeByMonth) {
    merchantVolumeByMonth = new MerchantVolumeByMonth(key);
    merchantVolumeByMonth.month = "";
    merchantVolumeByMonth.volume = BigInt.zero();
  }

  merchantVolumeByMonth.blockNumber = event.block.number;
  merchantVolumeByMonth.blockTimestamp = event.block.timestamp;
  merchantVolumeByMonth.transactionHash = event.transaction.hash;

  return merchantVolumeByMonth;
}

export function loadPaymentChannelMigration(
  key: Bytes,
  event: ethereum.Event
): PaymentChannelMigration {
  let migration = PaymentChannelMigration.load(key);
  if (!migration) {
    migration = new PaymentChannelMigration(key);
    migration.fromAccountNo = BigInt.zero();
    migration.toAccountNo = BigInt.zero();
    migration.fromPaymentChannelIndex = BigInt.zero();
    migration.toPaymentChannelIndex = BigInt.zero();
    migration.status = BigInt.zero(); // DEFAULT
    migration.fromFiatBalance = BigInt.zero();
    migration.toFiatBalance = BigInt.zero();
    migration.requestedAt = BigInt.zero();
    migration.settledAt = BigInt.zero();
  }

  migration.blockNumber = event.block.number;
  migration.blockTimestamp = event.block.timestamp;
  migration.transactionHash = event.transaction.hash;

  return migration;
}
