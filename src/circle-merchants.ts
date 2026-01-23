import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { MerchantRegisteredToCircle as MerchantRegisteredToCircleEvent } from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import { PaymentChannelMigrationRequest as PaymentChannelMigrationRequestEvent } from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
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

  let paymentChannels: Bytes[] = [];

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
    paymentChannels.push(paymentChannel.id);
  }

  merchant.paymentChannels = paymentChannels;
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

  let volumeByMonth = merchant.volumeByMonth;
  if (volumeByMonth == null) {
    volumeByMonth = [];
  }
  volumeByMonth.push(merchantVolumeByMonth.id);
  merchant.volumeByMonth = volumeByMonth;

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
  const migrationId = Bytes.fromHexString(
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
  }

  migration.save();

  // ADD MIGRATION TO MERCHANT'S LIST
  let migrations = merchant.paymentChannelMigrations;
  if (migrations == null) {
    migrations = [];
  }

  // Only add if not already present
  if (!migrations.includes(migrationId)) {
    migrations.push(migrationId);
    merchant.paymentChannelMigrations = migrations;
    merchant.save();
  }
}
