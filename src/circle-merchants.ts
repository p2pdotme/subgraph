import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  MerchantRegisteredToCircle as MerchantRegisteredToCircleEvent,
  PaymentChannelMigrationRequest as PaymentChannelMigrationRequestEvent,
  UnstakeRequested as UnstakeRequestedEvent,
  UnstakeRequestCancelled as UnstakeRequestCancelledEvent,
  UnstakeApproved as UnstakeApprovedEvent,
  MerchantWithoutFundsTracker as MerchantWithoutFundsTrackerEvent,
  MerchantStaked as MerchantStakedEvent,
  MonthlyVolumeUnlimitedFlagUpdated as MonthlyVolumeUnlimitedFlagUpdatedEvent,
} from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import {
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadCircleScoreState,
  loadMerchantPaymentChannels,
  loadMerchantVolumeByMonth,
  loadPaymentChannelMigration,
  loadFCMToken,
  updateActiveMerchantsCount,
  isMerchantActive,
  loadOrders,
} from "./lib";
import {
  OnlineOfflineToggled as OnlineOfflineToggledEvent,
  BlacklistMerchant as BlacklistMerchantEvent,
  MerchantOngoingOrder as MerchantOngoingOrderEvent,
  Merchant as MerchantEvent,
  MerchantVolume as MerchantVolumeEvent,
  FCMToken as FCMTokenEvent,
  MerchantRewardAllocatedForOrder as MerchantRewardAllocatedForOrderEvent,
  CircleAdminRewardAllocatedForOrder as CircleAdminRewardAllocatedForOrderEvent,
  CircleUSDCStakeDelegationRewardAllocatedForOrder as CircleUSDCStakeDelegationRewardAllocatedForOrderEvent,
} from "../generated/MerchantRegistryFacet/MerchantRegistryFacet";
import { getYearMonthFromTimestamp } from "./utils/date.utils";

export function handleMerchantRegisteredToCircle(
  event: MerchantRegisteredToCircleEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  merchant.circle = circle.id;
  merchant.circleId = event.params.circleId;
  merchant.merchant = event.params.merchant.toHexString();
  merchant.stakedAmount = event.params.stakeAmount;
  merchant.onlineAt = event.block.timestamp;
  merchant.isOnline = true;
  merchant.currency = event.params.currency;
  merchant.telegramId = event.params.telegramId;

  merchant.save();

  // UPDATE CIRCLE METRICS
  let circleMetrics = loadCircleMetrics(circle.id, event);
  let scoreState = loadCircleScoreState(circle.id, event);

  // UPDATE TOTAL MERCHANTS COUNT
  circleMetrics.totalMerchantsCount = circleMetrics.totalMerchantsCount.plus(
    BigInt.fromI32(1),
  );

  // New merchant: starts online and not blacklisted
  updateActiveMerchantsCount(
    scoreState,
    false,
    isMerchantActive(event.params.stakeAmount, true, false),
  );

  circleMetrics.save();
  scoreState.save();
}

export function handleOnlineOfflineToggled(
  event: OnlineOfflineToggledEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  const wasActive = isMerchantActive(
    merchant.stakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
  );

  merchant.isOnline = event.params.merchantDetails.isOnline;

  if (event.params.merchantDetails.isOnline) {
    merchant.onlineAt = event.block.timestamp;
  } else {
    merchant.offlineAt = event.block.timestamp;
  }

  merchant.save();

  const isActive = isMerchantActive(
    merchant.stakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
  );

  let circle = loadCircle(merchant.circle, event);
  let scoreState = loadCircleScoreState(circle.id, event);
  updateActiveMerchantsCount(scoreState, wasActive, isActive);
  scoreState.save();
}

export function handleBlacklistMerchant(event: BlacklistMerchantEvent): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  const wasActive = isMerchantActive(
    merchant.stakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
  );

  merchant.isBlacklisted = event.params.isBlacklist;

  merchant.paymentChannels
  merchant.save();

  const isActive = isMerchantActive(
    merchant.stakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
  );

  let circle = loadCircle(merchant.circle, event);
  let scoreState = loadCircleScoreState(circle.id, event);
  updateActiveMerchantsCount(scoreState, wasActive, isActive);
  scoreState.save();
}

export function handleMerchantOngoingOrder(
  event: MerchantOngoingOrderEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  merchant.isOngoingOrder = event.params.isOngoing;
  merchant.save();
}

export function handleMerchant(event: MerchantEvent): void {
  if (event.params.merchant.equals(Address.zero())) return;
  let merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  // ADD/UPDATE MERCHANT PAYMENT CHANNELS
  for (let i = 0; i < event.params.merchantConfig.paymentChannels.length; i++) {
    let paymentChannelDetails = event.params.merchantConfig.paymentChannels[i];

    const pcKey = Bytes.fromUTF8(
      `${event.params.merchant.toHexString()}-${paymentChannelDetails.accountNo.toString()}`,
    );
    let paymentChannel = loadMerchantPaymentChannels(pcKey, event);
    paymentChannel.merchant = merchant.id;
    paymentChannel.pcConfigId = paymentChannelDetails.paymentChannelConfigId;
    paymentChannel.accountNo = paymentChannelDetails.accountNo;
    paymentChannel.label = paymentChannelDetails.label;
    paymentChannel.isActive = paymentChannelDetails.isActive;
    paymentChannel.status = paymentChannelDetails.status;

    // Set fiat balance for the payment channel that matches the accountNo in the event
    if (paymentChannelDetails.accountNo.equals(event.params.accountNo)) {
      paymentChannel.fiatBalance = event.params.freeAmountFiat;
    }

    paymentChannel.save();
  }

  merchant.save();
}

export function handleMerchantVolume(event: MerchantVolumeEvent): void {
  if (event.params.merchant.equals(Address.zero())) return;
  // LOAD MERCHANT
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  // LOAD PAYMENT CHANNEL
  const pcKey = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-${event.params.accountNo.toString()}`,
  );
  const paymentChannel = loadMerchantPaymentChannels(pcKey, event);

  // UPDATE DAILY AND MONTHLY VOLUME ON PAYMENT CHANNEL
  paymentChannel.dailyVolume = event.params.dailyVolume;
  paymentChannel.monthlyVolume = event.params.monthlyVolume;
  paymentChannel.lastUpdatedDailyVolumeAt = event.block.timestamp;
  paymentChannel.save();

  // LOAD MERCHANT VOLUME BY MONTH
  const month = getYearMonthFromTimestamp(event.block.timestamp);
  const merchantVolumeByMonthKey = `${event.params.merchant.toHexString()}-${paymentChannel.id.toHexString()}-${merchant.circleId.toString()}-${month}`;
  const merchantVolumeByMonth = loadMerchantVolumeByMonth(
    Bytes.fromUTF8(merchantVolumeByMonthKey),
    event,
  );

  merchantVolumeByMonth.merchant = merchant.id;
  merchantVolumeByMonth.circle = merchant.circle;
  merchantVolumeByMonth.paymentChannel = paymentChannel.id;
  merchantVolumeByMonth.month = month;
  merchantVolumeByMonth.volume = event.params.monthlyVolume;

  merchantVolumeByMonth.save();
  merchant.save();
}

export function handlePaymentChannelMigrationRequest(
  event: PaymentChannelMigrationRequestEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  // LOAD MERCHANT
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  if (merchant.circleId.equals(BigInt.zero())) {
    return;
  }

  // CREATE CONSISTENT MIGRATION ID (without timestamp)
  // Using merchant address + fromAccountNo + toAccountNo as unique identifier
  // This allows us to track the same migration across status changes
  const migrationId = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-${event.params.fromAccountNo.toString()}-${event.params.toAccountNo.toString()}`,
  );

  // LOAD OR CREATE MIGRATION RECORD
  const migration = loadPaymentChannelMigration(migrationId, event);

  // Update migration record
  migration.merchant = merchant.id;
  migration.fromAccountNo = event.params.fromAccountNo;
  migration.toAccountNo = event.params.toAccountNo;
  migration.fromPaymentChannelIndex = event.params.fromPaymentChannelIndex;
  migration.toPaymentChannelIndex = event.params.toPaymentChannelIndex;
  migration.status = BigInt.fromI32(event.params.status);

  // Store fiat balances for both accounts
  migration.fromFiatBalance = event.params.fromFiatAmount;
  migration.toFiatBalance = event.params.toFiatAmount;

  // SET TIMESTAMPS
  // If status is PENDING, this is a new request - set requestedAt
  // If status is APPROVED or REJECTED, this is a settlement - set settledAt
  if (event.params.status === 1) {
    // PENDING
    migration.requestedAt = event.block.timestamp;
  } else if (event.params.status === 2 || event.params.status === 3) {
    // APPROVED or REJECTED
    migration.settledAt = event.block.timestamp;

    // UPDATE PAYMENT CHANNEL FIAT BALANCES AND STATUS WHEN MIGRATION IS APPROVED
    if (event.params.status === 2) {
      // APPROVED
      // Update "from" payment channel - set to TERMINATED with fiat balance 0
      const fromPcKey = Bytes.fromUTF8(
        `${event.params.merchant.toHexString()}-${event.params.fromAccountNo.toString()}`,
      );
      const fromPaymentChannel = loadMerchantPaymentChannels(fromPcKey, event);
      fromPaymentChannel.merchant = merchant.id;
      fromPaymentChannel.fiatBalance = event.params.fromFiatAmount;
      fromPaymentChannel.status = 5; // TERMINATED
      fromPaymentChannel.isActive = false;
      fromPaymentChannel.save();

      // Update "to" payment channel fiat balance
      const toPcKey = Bytes.fromUTF8(
        `${event.params.merchant.toHexString()}-${event.params.toAccountNo.toString()}`,
      );
      const toPaymentChannel = loadMerchantPaymentChannels(toPcKey, event);
      toPaymentChannel.merchant = merchant.id;
      toPaymentChannel.fiatBalance = event.params.toFiatAmount;
      toPaymentChannel.save();
    }
  }

  migration.save();
}

// UNSTAKE REQUEST HANDLERS

export function handleUnstakeRequested(event: UnstakeRequestedEvent): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  merchant.isUnstakeRequested = true;
  merchant.unstakeRequestedAt = event.block.timestamp;
  merchant.unstakeAmount = event.params.unstakeAmount;

  merchant.save();
}

export function handleUnstakeRequestCancelled(
  event: UnstakeRequestCancelledEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  if (merchant.circleId.equals(BigInt.zero())) {
    return;
  }

  merchant.isUnstakeRequested = false;
  merchant.unstakeRequestedAt = BigInt.zero();
  merchant.unstakeAmount = BigInt.zero();

  merchant.save();
}

export function handleUnstakeApproved(event: UnstakeApprovedEvent): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  const previousStakedAmount = merchant.stakedAmount;

  // Reset unstake request state
  merchant.isUnstakeRequested = false;
  merchant.unstakeRequestedAt = BigInt.zero();
  merchant.unstakeAmount = BigInt.zero();

  // Update staked amount
  merchant.stakedAmount = event.params.merchantDetails.stake;

  merchant.save();

  // SET FIAT BALANCE 0
  for (let i = 0; i < event.params.merchantConfig.paymentChannels.length; i++) {
    let paymentChannelDetails = event.params.merchantConfig.paymentChannels[i];
    const pcKey = Bytes.fromUTF8(
      `${event.params.merchant.toHexString()}-${paymentChannelDetails.accountNo.toString()}`,
    );
    let paymentChannel = loadMerchantPaymentChannels(pcKey, event);
    paymentChannel.fiatBalance = BigInt.fromI32(0);
    paymentChannel.save();
  }

  // Update active merchants count based on stake transition
  const wasActive = isMerchantActive(
    previousStakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
  );
  const isActive = isMerchantActive(
    event.params.stake,
    merchant.isOnline,
    merchant.isBlacklisted,
  );

  let circle = loadCircle(merchant.circle, event);
  let scoreState = loadCircleScoreState(circle.id, event);
  updateActiveMerchantsCount(scoreState, wasActive, isActive);
  scoreState.save();
}

export function handleMerchantStaked(event: MerchantStakedEvent): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  const previousStakedAmount = merchant.stakedAmount;

  // Update staked amount to new total stake
  merchant.stakedAmount = event.params.merchantDetails.stake;

  merchant.save();

  // Update active merchants count based on stake transition
  const wasActive = isMerchantActive(
    previousStakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
  );
  const isActive = isMerchantActive(
    event.params.stake,
    merchant.isOnline,
    merchant.isBlacklisted,
  );

  let circle = loadCircle(merchant.circle, event);
  let scoreState = loadCircleScoreState(circle.id, event);
  updateActiveMerchantsCount(scoreState, wasActive, isActive);
  scoreState.save();
}

export function handleMerchantWithoutFundsTracker(
  event: MerchantWithoutFundsTrackerEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  // Update telegram ID from merchant config
  merchant.telegramId = event.params.merchantConfig.telegramId;

  merchant.save();
}

export function handleMonthlyVolumeUnlimitedFlagUpdated(
  event: MonthlyVolumeUnlimitedFlagUpdatedEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchantEntity = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  if (
    merchantEntity.circleId.equals(BigInt.zero()) ||
    event.params.accountNo.toString().length < 4
  ) {
    return;
  }

  const paymentChannelConfigId = event.params.accountNo.toString().slice(0, -4);
  const pcKey = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-${event.params.accountNo.toString()}`,
  );
  let paymentChannel = loadMerchantPaymentChannels(pcKey, event);
  const isNewPaymentChannel = paymentChannel.pcConfigId.equals(BigInt.zero());

  paymentChannel.isMonthlyVolumeUnlimited =
    event.params.isMonthlyVolumeUnlimited;
  paymentChannel.merchant = merchantEntity.id;
  paymentChannel.accountNo = event.params.accountNo;
  paymentChannel.pcConfigId = BigInt.fromString(paymentChannelConfigId);

  if (isNewPaymentChannel) {
    paymentChannel.isActive = false;
    paymentChannel.status = 0;
  }

  paymentChannel.save();
}

export function handleFCMToken(event: FCMTokenEvent): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  if (merchant.circleId.equals(BigInt.zero())) {
    return;
  }

  const fcmToken = loadFCMToken(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  fcmToken.address = event.params.merchant;
  fcmToken.tokens = event.params.tokens;
  fcmToken.merchant = merchant.id;
  fcmToken.save();
}

export function handleMerchantRewardAllocatedForOrder(
  event: MerchantRewardAllocatedForOrderEvent,
): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
  );
  order.merchantRewardAmount = event.params.amount;
  order.save();
}

export function handleCircleAdminRewardAllocatedForOrder(
  event: CircleAdminRewardAllocatedForOrderEvent,
): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
  );
  order.circleAdminRewardAmount = event.params.amount;
  order.save();
}

export function handleCircleUSDCStakeDelegationRewardAllocatedForOrder(
  event: CircleUSDCStakeDelegationRewardAllocatedForOrderEvent,
): void {
  let order = loadOrders(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId)),
    event,
  );
  order.circleUSDCStakeDelegationRewardAmount = event.params.amount;
  order.save();
}
