import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { MerchantRegisteredToCircle as MerchantRegisteredToCircleEvent } from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import {
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadMerchantPaymentChannels,
  loadMerchantVolumeByMonth,
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

    const pcKey = Bytes.fromHexString(
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
  const pcKey = Bytes.fromHexString(
    `${event.params.merchant.toHexString()}-${event.params.accountNo}`
  );
  const paymentChannel = loadMerchantPaymentChannels(pcKey, event);

  // LOAD MERCHANT VOLUME
  const merchantVolumeKey = Bytes.fromHexString(
    `${event.params.merchant.toHexString()}-${paymentChannel.id}-${
      merchant.circleId
    }`
  );

  // LOAD MERCHANT VOLUME BY MONTH
  const month = getYearMonthFromTimestamp(event.block.timestamp);
  const merchantVolumeByMonth = loadMerchantVolumeByMonth(
    Bytes.fromHexString(`${merchantVolumeKey}-${month}`),
    event
  );

  merchantVolumeByMonth.merchant = merchant.id;
  merchantVolumeByMonth.circle = merchant.circle;
  merchantVolumeByMonth.paymentChannel = paymentChannel.id;
  merchantVolumeByMonth.month = month;
  merchantVolumeByMonth.volume = event.params.monthlyVolume.plus(
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
