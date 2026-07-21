import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  // CircleCreatedUpdate as CircleCreatedUpdateEvent,
  CircleMerchantDetailsAndConfigUpdate as CircleMerchantDetailsAndConfigUpdateEvent,
  MerchantPaymentChannelUpdate as MerchantPaymentChannelUpdateEvent,
  CurrencyAddedUpdate as CurrencyAddedUpdateEvent,
  CurrencyMonthlyVolumeLimitUpdate as CurrencyMonthlyVolumeLimitUpdateEvent,
  MerchantWithdrawFeePercentageUpdate as MerchantWithdrawFeePercentageUpdateEvent,
  PaymentChannelConfigUpdate as PaymentChannelConfigUpdateEvent,
  MerchantClaimableRewardsUpdate as MerchantClaimableRewardsUpdateEvent,
  MerchantWithdrawFeePercentage as MerchantWithdrawFeePercentageEvent,
} from "../generated/SetterFacet/SetterFacet";
import { CurrencyConfig, PaymentChannelConfig } from "../generated/schema";
import {
  isMerchantActive,
  isMerchantAvailable,
  loadCircle,
  loadCircleMerchant,
  loadCircleMetrics,
  loadCircleScoreState,
  loadCurrency,
  loadMerchantPaymentChannels,
  savePaymentChannel,
  loadMerchantRewards,
  loadMerchantWithdrawFeePercentage,
  updateAvailableMerchantsCount,
} from "./lib";

// export function handleCircleCreatedUpdate(
//   event: CircleCreatedUpdateEvent,
// ): void {
//   const key = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
//   const circle = loadCircle(key, event);

//   circle.circleId = event.params.circleId;
//   circle.admin = event.params.admin.toHexString();
//   circle.currency = event.params.currency;
//   circle.name = event.params.name;
//   circle.communityLink = event.params.communityUrl;
//   circle.adminLink = event.params.adminCommunityUrl;
//   circle.isAutoApprovedPCEnabled = event.params.autoApprovePaymentChannels;

//   circle.save();
// }

export function handleCircleMerchantDetailsAndConfigUpdate(
  event: CircleMerchantDetailsAndConfigUpdateEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const key = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(key, event);

  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  // Snapshot availability BEFORE the bulk overwrite so we can emit a proper delta.
  const wasAvailable = isMerchantAvailable(
    merchant.stakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
    merchant.isUnstakeRequested,
  );

  merchant.circle = circle.id;
  merchant.circleId = event.params.circleId;
  merchant.currency = event.params.currency;
  merchant.merchant = event.params.merchant.toHexString();
  merchant.stakedAmount = event.params.stake;
  merchant.delegatedStakedAmount = event.params.delegatedStake;
  merchant.telegramId = event.params.telegramId;
  merchant.isOnline = event.params.isOnline;
  merchant.isBlacklisted = event.params.isBlacklisted;
  merchant.unstakeRequestedAt = event.params.unstakeRequestedAt;
  merchant.isUnstakeRequested = event.params.isUnstakeRequested;
  merchant.unstakeAmount = event.params.unstakeAmount;
  merchant.startedAt = event.params.startedAt;
  merchant.onlineAt = event.params.onlineAt;
  merchant.offlineAt = event.params.offlineAt;

  merchant.save();

  // Persist the Circle so the CircleMerchant.circle link never dangles:
  // loadCircle only materializes it in memory.
  circle.save();

  let circleMetrics = loadCircleMetrics(circle.id, event);
  circleMetrics.totalMerchantsCount = circleMetrics.totalMerchantsCount.plus(
    BigInt.fromI32(1),
  );
  circleMetrics.save();

  const isActive = isMerchantActive(
    merchant.stakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
  );

  if (isActive) {
    let scoreState = loadCircleScoreState(circle.id, event);
    scoreState.activeMerchantsCount = scoreState.activeMerchantsCount.plus(
      BigInt.fromI32(1),
    );
    scoreState.save();
  }

  const isAvailable = isMerchantAvailable(
    merchant.stakedAmount,
    merchant.isOnline,
    merchant.isBlacklisted,
    merchant.isUnstakeRequested,
  );
  if (wasAvailable != isAvailable) {
    let scoreState = loadCircleScoreState(circle.id, event);
    updateAvailableMerchantsCount(scoreState, wasAvailable, isAvailable);
    scoreState.save();
  }
}

export function handleMerchantPaymentChannelUpdate(
  event: MerchantPaymentChannelUpdateEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );

  const pcKey = Bytes.fromUTF8(
    `${event.params.merchant.toHexString()}-${event.params.accountNo.toString()}`,
  );
  let paymentChannel = loadMerchantPaymentChannels(pcKey, event);
  paymentChannel.merchant = merchant.id;
  paymentChannel.pcConfigId = event.params.paymentChannelConfigId;
  paymentChannel.accountNo = event.params.accountNo;
  paymentChannel.label = event.params.label;
  paymentChannel.isActive = event.params.isActive;
  paymentChannel.status = event.params.status;
  paymentChannel.isMonthlyVolumeUnlimited =
    event.params.isMonthlyVolumeUnlimited;
  paymentChannel.fiatBalance = event.params.freeFiatAmount;
  paymentChannel.dailyVolume = event.params.dailyVolume;
  paymentChannel.monthlyVolume = event.params.monthlyVolume;
  paymentChannel.lastUpdatedDailyVolumeAt = event.block.timestamp;
  savePaymentChannel(paymentChannel);
}

export function handleCurrencyAddedUpdate(
  event: CurrencyAddedUpdateEvent,
): void {
  const currency = loadCurrency(event.params.currency, event);
  currency.isActive = event.params.isActive;
  currency.save();
}

export function handleCurrencyMonthlyVolumeLimitUpdate(
  event: CurrencyMonthlyVolumeLimitUpdateEvent,
): void {
  const id = event.params.currency;
  let config = CurrencyConfig.load(id);
  if (!config) {
    config = new CurrencyConfig(id);
    config.currency = event.params.currency;
  }
  config.monthlyVolumeLimit = event.params.newLimit;
  config.blockNumber = event.block.number;
  config.blockTimestamp = event.block.timestamp;
  config.transactionHash = event.transaction.hash;
  config.save();
}

export function handleMerchantWithdrawFeePercentageUpdate(
  event: MerchantWithdrawFeePercentageUpdateEvent,
): void {
  const withdrawFee = loadMerchantWithdrawFeePercentage(
    event.params.currency.concat(
      Bytes.fromByteArray(Bytes.fromBigInt(event.block.timestamp)),
    ),
    event,
  );
  withdrawFee.currency = event.params.currency;
  withdrawFee.feePercentage = event.params.newFeePercentage;
  withdrawFee.time = event.block.timestamp;
  withdrawFee.save();
}

export function handlePaymentChannelConfigUpdate(
  event: PaymentChannelConfigUpdateEvent,
): void {
  const id = changetype<Bytes>(Bytes.fromBigInt(event.params.paymentChannelId));
  let config = PaymentChannelConfig.load(id);
  if (!config) {
    config = new PaymentChannelConfig(id);
  }
  config.paymentChannelId = event.params.paymentChannelId;
  config.currency = event.params.currency;
  config.name = event.params.name;
  config.dailyVolumeLimit = event.params.dailyVolumeLimit;
  config.isActive = event.params.isActive;
  config.blockNumber = event.block.number;
  config.blockTimestamp = event.block.timestamp;
  config.transactionHash = event.transaction.hash;
  config.save();
}

export function handleMerchantClaimableRewardsUpdate(
  event: MerchantClaimableRewardsUpdateEvent,
): void {
  if (event.params.merchant.equals(Address.zero())) return;
  const merchantRewards = loadMerchantRewards(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  merchantRewards.merchant = event.params.merchant.toHexString();
  merchantRewards.claimableRewards = event.params.claimableRewards;
  merchantRewards.save();
}

export function handleMerchantWithdrawFeePercentage(
  event: MerchantWithdrawFeePercentageEvent,
): void {
  const withdrawFee = loadMerchantWithdrawFeePercentage(
    event.params.currency.concat(
      Bytes.fromByteArray(Bytes.fromBigInt(event.block.timestamp)),
    ),
    event,
  );
  withdrawFee.currency = event.params.currency;
  withdrawFee.feePercentage = event.params.feePercentage;
  withdrawFee.time = event.block.timestamp;
  withdrawFee.save();
}
