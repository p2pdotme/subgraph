import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AssignedMerchants,
  CircleMerchant,
  MerchantPaymentChannels,
  MerchantVolumeByMonth,
  MerchantOrderMetricsByMonth,
  PaymentChannelMigration,
  MerchantDelegationRecord,
  MerchantReferralClaimed,
  MerchantReferralRevenueClaimed,
} from "../../generated/schema";

export function loadAssignedMerchants(
  key: Bytes,
  event: ethereum.Event,
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
  event: ethereum.Event,
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
    circleMerchant.isUnstakeRequested = false;
    circleMerchant.unstakeRequestedAt = BigInt.zero();
    circleMerchant.unstakeAmount = BigInt.zero();
    circleMerchant.onlineAt = BigInt.zero();
    circleMerchant.offlineAt = BigInt.zero();
    circleMerchant.startedAt = BigInt.zero();
    circleMerchant.currency = Bytes.empty();
  }

  circleMerchant.blockNumber = event.block.number;
  circleMerchant.blockTimestamp = event.block.timestamp;
  circleMerchant.transactionHash = event.transaction.hash;

  return circleMerchant;
}

export function loadMerchantPaymentChannels(
  key: Bytes,
  event: ethereum.Event,
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
    merchantPaymentChannel.dailyVolume = BigInt.zero();
    merchantPaymentChannel.monthlyVolume = BigInt.zero();
  }

  merchantPaymentChannel.blockNumber = event.block.number;
  merchantPaymentChannel.blockTimestamp = event.block.timestamp;
  merchantPaymentChannel.transactionHash = event.transaction.hash;

  return merchantPaymentChannel;
}

export function loadMerchantVolumeByMonth(
  key: Bytes,
  event: ethereum.Event,
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
  event: ethereum.Event,
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

export function loadMerchantOrderMetricsByMonth(
  key: Bytes,
  event: ethereum.Event,
): MerchantOrderMetricsByMonth {
  let metrics = MerchantOrderMetricsByMonth.load(key);
  if (!metrics) {
    metrics = new MerchantOrderMetricsByMonth(key);
    metrics.month = "";
    metrics.completedOrdersCount = BigInt.zero();
    metrics.cancelledOrdersCount = BigInt.zero();
  }

  metrics.blockNumber = event.block.number;
  metrics.blockTimestamp = event.block.timestamp;
  metrics.transactionHash = event.transaction.hash;

  return metrics;
}

export function loadMerchantDelegationRecord(
  key: Bytes,
  event: ethereum.Event,
): MerchantDelegationRecord {
  let record = MerchantDelegationRecord.load(key);
  if (!record) {
    record = new MerchantDelegationRecord(key);
    record.type = "";
    record.amount = BigInt.zero();
    record.balanceAfter = BigInt.zero();
  }

  record.blockNumber = event.block.number;
  record.blockTimestamp = event.block.timestamp;
  record.transactionHash = event.transaction.hash;

  return record;
}

export function loadMerchantReferralClaimed(
  key: Bytes,
  event: ethereum.Event,
): MerchantReferralClaimed {
  let referralClaimed = MerchantReferralClaimed.load(key);
  if (!referralClaimed) {
    referralClaimed = new MerchantReferralClaimed(key);
    referralClaimed.recommender = Bytes.empty();
    referralClaimed.recipient = Bytes.empty();
  }

  referralClaimed.blockNumber = event.block.number;
  referralClaimed.blockTimestamp = event.block.timestamp;
  referralClaimed.transactionHash = event.transaction.hash;

  return referralClaimed;
}

export function loadMerchantReferralRevenueClaimed(
  key: Bytes,
  event: ethereum.Event,
): MerchantReferralRevenueClaimed {
  let revenueClaimed = MerchantReferralRevenueClaimed.load(key);
  if (!revenueClaimed) {
    revenueClaimed = new MerchantReferralRevenueClaimed(key);
    revenueClaimed.yearMonthKey = BigInt.zero();
    revenueClaimed.reward = BigInt.zero();
  }

  revenueClaimed.blockNumber = event.block.number;
  revenueClaimed.blockTimestamp = event.block.timestamp;
  revenueClaimed.transactionHash = event.transaction.hash;

  return revenueClaimed;
}
