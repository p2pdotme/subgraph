import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  MerchantRegisteredToCircle as MerchantRegisteredToCircleEvent,
  PaymentChannelMigrationRequest as PaymentChannelMigrationRequestEvent,
  UnstakeRequested as UnstakeRequestedEvent,
  UnstakeRequestCancelled as UnstakeRequestCancelledEvent,
  UnstakeApproved as UnstakeApprovedEvent,
} from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import {
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadMerchantPaymentChannels,
  loadMerchantVolumeByMonth,
  loadPaymentChannelMigration,
} from "./lib";
import {
  OnlineOfflineToggled as OnlineOfflineToggledEvent,
  BlacklistMerchant as BlacklistMerchantEvent,
  MerchantOngoingOrder as MerchantOngoingOrderEvent,
  Merchant as MerchantEvent,
  MerchantVolume as MerchantVolumeEvent,
} from "../generated/MerchantRegistryFacet/MerchantRegistryFacet";
import { getYearMonthFromTimestamp } from "./utils/date.utils";

export function handleMerchantRegisteredToCircle(
  event: MerchantRegisteredToCircleEvent
): void {
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
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

  // UPDATE TOTAL MERCHANTS COUNT
  circleMetrics.totalMerchantsCount = circleMetrics.totalMerchantsCount.plus(
    BigInt.fromI32(1)
  );

  circleMetrics.save();
}

export function handleOnlineOfflineToggled(
  event: OnlineOfflineToggledEvent
): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );
  merchant.isOnline = event.params.merchantDetails.isOnline;

  if (event.params.merchantDetails.isOnline) {
    merchant.onlineAt = event.block.timestamp;
  } else {
    merchant.offlineAt = event.block.timestamp;
  }

  merchant.save();
}

export function handleBlacklistMerchant(event: BlacklistMerchantEvent): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );
  merchant.isBlacklisted = event.params.isBlacklist;
  merchant.save();
}

export function handleMerchantOngoingOrder(
  event: MerchantOngoingOrderEvent
): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );
  merchant.isOngoingOrder = event.params.isOngoing;
  merchant.save();
}

export function handleMerchant(event: MerchantEvent): void {
  let merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  // ADD/UPDATE MERCHANT PAYMENT CHANNELS
  for (let i = 0; i < event.params.merchantConfig.paymentChannels.length; i++) {
    let paymentChannelDetails = event.params.merchantConfig.paymentChannels[i];

    const pcKey = Bytes.fromUTF8(
      `${event.params.merchant.toHexString()}-${paymentChannelDetails.accountNo.toString()}`
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
  // LOAD MERCHANT
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  // LOAD PAYMENT CHANNEL
  const pcKey = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-${event.params.accountNo.toString()}`
  );
  const paymentChannel = loadMerchantPaymentChannels(pcKey, event);

  // UPDATE DAILY AND MONTHLY VOLUME ON PAYMENT CHANNEL
  paymentChannel.dailyVolume = event.params.dailyVolume;
  paymentChannel.monthlyVolume = event.params.monthlyVolume;
  paymentChannel.save();

  // LOAD MERCHANT VOLUME BY MONTH
  const month = getYearMonthFromTimestamp(event.block.timestamp);
  const merchantVolumeByMonthKey = `${event.params.merchant.toHexString()}-${paymentChannel.id.toHexString()}-${merchant.circleId.toString()}-${month}`;
  const merchantVolumeByMonth = loadMerchantVolumeByMonth(
    Bytes.fromUTF8(merchantVolumeByMonthKey),
    event
  );

  merchantVolumeByMonth.merchant = merchant.id;
  merchantVolumeByMonth.circle = merchant.circle;
  merchantVolumeByMonth.paymentChannel = paymentChannel.id;
  merchantVolumeByMonth.month = month;
  merchantVolumeByMonth.volume = merchantVolumeByMonth.volume.plus(
    event.params.monthlyVolume
  );

  merchantVolumeByMonth.save();
  merchant.save();
}

export function handlePaymentChannelMigrationRequest(
  event: PaymentChannelMigrationRequestEvent
): void {
  // LOAD MERCHANT
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  // CREATE CONSISTENT MIGRATION ID (without timestamp)
  // Using merchant address + fromAccountNo + toAccountNo as unique identifier
  // This allows us to track the same migration across status changes
  const migrationId = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-${event.params.fromAccountNo.toString()}-${event.params.toAccountNo.toString()}`
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
  if (event.params.status === 1) { // PENDING
    migration.requestedAt = event.block.timestamp;
  } else if (event.params.status === 2 || event.params.status === 3) { // APPROVED or REJECTED
    migration.settledAt = event.block.timestamp;

    // UPDATE PAYMENT CHANNEL FIAT BALANCES AND STATUS WHEN MIGRATION IS APPROVED
    if (event.params.status === 2) { // APPROVED
      // Update "from" payment channel - set to TERMINATED with fiat balance 0
      const fromPcKey = Bytes.fromUTF8(
        `${event.params.merchant.toHexString()}-${event.params.fromAccountNo.toString()}`
      );
      const fromPaymentChannel = loadMerchantPaymentChannels(fromPcKey, event);
      fromPaymentChannel.fiatBalance = event.params.fromFiatAmount;
      fromPaymentChannel.status = 5; // TERMINATED
      fromPaymentChannel.isActive = false;
      fromPaymentChannel.save();

      // Update "to" payment channel fiat balance
      const toPcKey = Bytes.fromUTF8(
        `${event.params.merchant.toHexString()}-${event.params.toAccountNo.toString()}`
      );
      const toPaymentChannel = loadMerchantPaymentChannels(toPcKey, event);
      toPaymentChannel.fiatBalance = event.params.toFiatAmount;
      toPaymentChannel.save();
    }
  }

  migration.save();
}

// UNSTAKE REQUEST HANDLERS

export function handleUnstakeRequested(event: UnstakeRequestedEvent): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  merchant.isUnstakeRequested = true;
  merchant.unstakeRequestedAt = event.block.timestamp;
  merchant.unstakeAmount = event.params.unstakeAmount;

  merchant.save();
}

export function handleUnstakeRequestCancelled(
  event: UnstakeRequestCancelledEvent
): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  merchant.isUnstakeRequested = false;
  merchant.unstakeRequestedAt = BigInt.zero();
  merchant.unstakeAmount = BigInt.zero();

  merchant.save();
}

export function handleUnstakeApproved(event: UnstakeApprovedEvent): void {
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event
  );

  // Reset unstake request state
  merchant.isUnstakeRequested = false;
  merchant.unstakeRequestedAt = BigInt.zero();
  merchant.unstakeAmount = BigInt.zero();

  // Update staked amount
  merchant.stakedAmount = event.params.stake;

  merchant.save();
}
