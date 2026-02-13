import { BigInt, Bytes, ethereum, store } from "@graphprotocol/graph-ts";
import {
  Circle,
  CircleDailyMetrics,
  CircleMetrics,
  CircleOrderMetricsByMonth,
  CircleMerchant,
  MerchantPaymentChannels,
  CurrencyPrice,
  PaymentChannelConfig,
  MonthlyVolumeLimit,
} from "../../generated/schema";
import { STATUS_BOOTSTRAP, SECONDS_PER_DAY } from "../constants/circle-score";
import {
  PAYMENT_CHANNEL_STATUS_APPROVED,
  PAYMENT_CHANNEL_STATUS_ON_HOLD,
} from "../constants/status";
import {
  getDayStringFromTimestamp,
  getMonthStringFromTimestamp,
  getYearStringFromTimestamp,
} from "../utils";

export const loadCircle = (key: Bytes, event: ethereum.Event): Circle => {
  let circle = Circle.load(key);
  if (!circle) {
    circle = new Circle(key);
    circle.circleId = BigInt.zero();
    circle.admin = "";
    circle.currency = Bytes.empty();
    circle.name = "";
    circle.communityLink = "";
    circle.isAutoApprovedPCEnabled = false;
  }

  circle.blockNumber = event.block.number;
  circle.blockTimestamp = event.block.timestamp;
  circle.transactionHash = event.transaction.hash;

  return circle;
};

export function loadCircleMetrics(
  key: Bytes,
  event: ethereum.Event,
): CircleMetrics {
  let circleMetrics = CircleMetrics.load(key);
  if (!circleMetrics) {
    circleMetrics = new CircleMetrics(key);
    circleMetrics.totalStaked = BigInt.zero();
    circleMetrics.adminStaked = BigInt.zero();
    circleMetrics.totalVolume = BigInt.zero();
    circleMetrics.resolvedDisputesCount = BigInt.zero();
    circleMetrics.raisedDisputesCount = BigInt.zero();
    circleMetrics.totalDelegatedStake = BigInt.zero();
    circleMetrics.totalMerchantsCount = BigInt.zero();
    circleMetrics.totalPlacedOrdersCount = BigInt.zero();
    // Initialize circle score fields
    circleMetrics.circleScore = BigInt.fromI32(50); // bootstrap default
    circleMetrics.circleStatus = STATUS_BOOTSTRAP;
    circleMetrics.avgSettlementSeconds = BigInt.zero();
    circleMetrics.disputeRate = BigInt.zero();
    circleMetrics.rolling30dVolume = BigInt.zero();
    circleMetrics.lifetimeAcceptedOrders = BigInt.zero();
    circleMetrics.cumulativeSettlementSeconds = BigInt.zero();
    circleMetrics.totalCompletedOrders = BigInt.zero();
    circleMetrics.activeMerchantsCount = BigInt.zero();
    circleMetrics.merchantFaultDisputesCount = BigInt.zero();
    circleMetrics.hasMinOrdersForScore = false;
    circleMetrics.lastScoreUpdateTimestamp = BigInt.zero();
    circleMetrics.maxFiatAllowed = BigInt.zero();
    circleMetrics.maxUsdcAllowed = BigInt.zero();
    circleMetrics.maxLimitLog = "";
  }

  circleMetrics.blockNumber = event.block.number;
  circleMetrics.blockTimestamp = event.block.timestamp;
  circleMetrics.transactionHash = event.transaction.hash;

  return circleMetrics;
}

export function loadCircleDailyMetrics(
  key: Bytes,
  event: ethereum.Event,
): CircleDailyMetrics {
  let daily = CircleDailyMetrics.load(key);
  if (!daily) {
    daily = new CircleDailyMetrics(key);
    daily.circle = Bytes.empty();
    daily.dayNumber = BigInt.zero();
    daily.settlementSecondsSum = BigInt.zero();
    daily.completedOrdersCount = BigInt.zero();
    daily.acceptedOrdersCount = BigInt.zero();
    daily.merchantFaultDisputesCount = BigInt.zero();
    daily.volume = BigInt.zero();
  }

  daily.blockNumber = event.block.number;
  daily.blockTimestamp = event.block.timestamp;
  daily.transactionHash = event.transaction.hash;

  return daily;
}

export function getDayNumber(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_DAY;
}

export function getDailyMetricsKey(circleId: Bytes, dayNumber: i32): Bytes {
  return Bytes.fromUTF8(circleId.toHexString() + "-" + dayNumber.toString());
}

export function loadCircleOrderMetricsByMonth(
  key: Bytes,
  event: ethereum.Event,
): CircleOrderMetricsByMonth {
  let metrics = CircleOrderMetricsByMonth.load(key);
  if (!metrics) {
    metrics = new CircleOrderMetricsByMonth(key);
    metrics.month = "";
    metrics.totalCompletedOrdersCount = BigInt.zero();
    metrics.totalCancelledOrdersCount = BigInt.zero();
  }

  metrics.blockNumber = event.block.number;
  metrics.blockTimestamp = event.block.timestamp;
  metrics.transactionHash = event.transaction.hash;

  return metrics;
}

/**
 * Iterate over all MerchantPaymentChannels to recalculate and update maxFiatAllowed and maxUsdcAllowed for the given circle
 */
export function updateCircleMaxAllowedBalance(
  circleMetrics: CircleMetrics,
  circleId: Bytes,
): void {
  let maxFiat = BigInt.zero();
  let maxUsdc = BigInt.zero();
  let sellPrice = BigInt.zero();
  let logString = "";

  const currentTimestamp = circleMetrics.blockTimestamp;

  // LOAD CIRCLE MERCHANTS
  const merchants = store.loadRelated(
    "Circle",
    circleId.toHexString(),
    "merchants",
  );

  // LOAD CIRCLE
  const circle = Circle.load(circleId);

  // SET SELL PRICE
  if (circle && !circle.currency.equals(Bytes.empty())) {
    const currencyPrice = CurrencyPrice.load(circle.currency);
    if (currencyPrice) {
      sellPrice = currencyPrice.sellExchangePrice;
    }
  }

  // LOOP THROUGH MERCHANT
  for (let i = 0; i < merchants.length; i++) {
    let totalMerchantFiatBalance = BigInt.zero();

    // LOAD MERCHANT PAYMENT CHANNELS
    const merchant = changetype<CircleMerchant>(merchants[i]);
    const paymentChannels = store.loadRelated(
      "CircleMerchant",
      merchant.get("id")!.toBytes().toHexString(),
      "paymentChannels",
    );

    // STAKED AMOUNT = STAKED AMOUNT + DELEGATED STAKED AMOUNT
    const merchantStakedAmount = merchant.stakedAmount.plus(
      merchant.delegatedStakedAmount,
    );

    // MERCHANT LEVEL CHECKS
    const isOnline = merchant.get("isOnline")!.toBoolean();
    const isBlacklisted = merchant.get("isBlacklisted")!.toBoolean();
    const isOngoingOrder = merchant.get("isOngoingOrder")!.toBoolean();
    const isDisputeOngoing = merchant.get("isDisputeOngoing")!.toBoolean();
    const isUnstakeRequested = merchant.get("isUnstakeRequested")!.toBoolean();

    // LOOP THROUGH MERCHANT PAYMENT CHANNELS
    for (let j = 0; j < paymentChannels.length; j++) {
      const pc = changetype<MerchantPaymentChannels>(paymentChannels[j]);

      // LOAD PAYMENT CHANNEL CONFIG
      const pcConfigId = pc.get("pcConfigId")!.toBigInt();
      const pcConfigKey = Bytes.fromI32(pcConfigId.toI32());
      const paymentChannelConfig = PaymentChannelConfig.load(pcConfigKey);
      const dailyVolumeLimit = paymentChannelConfig
        ? paymentChannelConfig.dailyVolumeLimit
        : BigInt.zero();

      // PAYMENT CHANNEL LEVEL CHECKS
      const fiatBalance = pc.get("fiatBalance")!.toBigInt();
      const status = pc.get("status")!.toI32();
      const isActive = pc.get("isActive")!.toBoolean();
      let isDailyVolumeReached = false;
      let isMonthlyVolumeReached = false;

      // ===========================
      // 📊 VOLUME LIMIT VERIFICATION
      // ===========================
      const volumeUpdatedAt = pc.get("volumeUpdatedAt")!.toString();
      const volumeParts = volumeUpdatedAt.split("-");
      const volumeDay = volumeParts.length > 0 ? volumeParts[0] : "";
      const volumeMonth = volumeParts.length > 1 ? volumeParts[1] : "";
      const volumeYear = volumeParts.length > 2 ? volumeParts[2] : "";

      // DAILY VOLUME CHECK
      if (volumeDay == getDayStringFromTimestamp(currentTimestamp)) {
        const dailyVolume = pc.get("dailyVolume")!.toBigInt();
        if (dailyVolume.ge(dailyVolumeLimit)) {
          isDailyVolumeReached = true;
        }
      }

      // MONTHLY VOLUME CHECK
      if (
        volumeMonth == getMonthStringFromTimestamp(currentTimestamp) &&
        volumeYear == getYearStringFromTimestamp(currentTimestamp) &&
        circle != null &&
        !circle.currency.equals(Bytes.empty())
      ) {
        const monthlyVolumeLimit = MonthlyVolumeLimit.load(circle.currency);
        const limit = monthlyVolumeLimit
          ? monthlyVolumeLimit.limit
          : BigInt.zero();
        const monthlyVolume = pc.get("monthlyVolume")!.toBigInt();

        const isMonthlyVolumeUnlimited = pc
          .get("isMonthlyVolumeUnlimited")!
          .toBoolean();

        if (!isMonthlyVolumeUnlimited && limit.ge(monthlyVolume)) {
          isMonthlyVolumeReached = true;
        }
      }

      // UPDATE MAX FIAT ALLOWED (exclude when daily volume limit reached)
      if (
        fiatBalance.gt(maxFiat) &&
        (status === PAYMENT_CHANNEL_STATUS_APPROVED ||
          status === PAYMENT_CHANNEL_STATUS_ON_HOLD) &&
        isActive &&
        !isDailyVolumeReached &&
        !isMonthlyVolumeReached &&
        isOnline &&
        !isBlacklisted &&
        !isOngoingOrder &&
        !isDisputeOngoing &&
        !isUnstakeRequested
      ) {
        maxFiat = fiatBalance;

        // UPDATE MAX LIMIT LOG
        logString += `{"maxFiat":{"merchant":"${merchant.get("merchant")!.toString()}","accountNo":"${pc.get("accountNo")!.toBigInt().toString()}","updatedAt":"${currentTimestamp.toString()}"}},`;
      }

      totalMerchantFiatBalance = totalMerchantFiatBalance.plus(fiatBalance);
    }

    // UPDATE MAX USDC ALLOWED
    if (
      sellPrice.gt(BigInt.zero()) &&
      isOnline &&
      !isBlacklisted &&
      !isOngoingOrder &&
      !isDisputeOngoing &&
      !isUnstakeRequested
    ) {
      let usdcBalance = BigInt.zero();

      // COMPUTE USDC BALANCE
      // 1. Convert fiat balance to USDC (fiat balance * 1_000_000)
      // 2. Divide by sellPrice to get USDC balance
      // 3. Subtract fiatInUsdc from staked amount to get available USDC balance
      const USDC_DECIMALS = BigInt.fromI32(1_000_000);
      const fiatInUsdc = totalMerchantFiatBalance
        .times(USDC_DECIMALS)
        .div(sellPrice);

      if (fiatInUsdc.gt(merchantStakedAmount)) {
        usdcBalance = BigInt.zero();
      } else {
        usdcBalance = merchantStakedAmount.minus(fiatInUsdc);
      }

      // UPDATE MAX USDC ALLOWED
      if (usdcBalance.gt(maxUsdc)) {
        maxUsdc = usdcBalance;

        // UPDATE MAX LIMIT LOG
        logString += `{"maxUsdc":{"merchant":"${merchant.get("merchant")!.toString()}","selfStakedAmount":"${merchant.stakedAmount.toString()}","delegatedStakedAmount":"${merchant.delegatedStakedAmount.toString()}","sellPrice":"${sellPrice.toString()}","fiatBalance":"${totalMerchantFiatBalance.toString()}","updatedAt":"${currentTimestamp.toString()}"}},`;
      }
    }
  }

  circleMetrics.maxFiatAllowed = maxFiat;
  circleMetrics.maxUsdcAllowed = maxUsdc;
  circleMetrics.maxLimitLog = `[${logString}]`;
}
