import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { MerchantRegisteredToCircle as MerchantRegisteredToCircleEvent } from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import {
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadMerchantPaymentChannels,
} from "./utils";
import {
  OnlineOfflineToggled as OnlineOfflineToggledEvent,
  BlacklistMerchant as BlacklistMerchantEvent,
  MerchantOngoingOrder as MerchantOngoingOrderEvent,
  Merchant as MerchantEvent,
} from "../generated/MerchantRegistryFacet/MerchantRegistryFacet";

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
    paymentChannel.save();
    paymentChannels.push(paymentChannel.id);
  }

  merchant.paymentChannels = paymentChannels;
  merchant.save()
}
