import { BigInt, Bytes, ethereum, store } from "@graphprotocol/graph-ts";
import {
  Circle,
  CircleDailyMetrics,
  CircleMetrics,
  CircleOrderMetricsByMonth,
  CircleMerchant,
  MerchantPaymentChannels,
  CurrencyPrice,
} from "../../generated/schema";
import { STATUS_BOOTSTRAP, SECONDS_PER_DAY } from "../constants/circle-score";

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
 * Recompute maxFiatAllowed for a circle by looping through all MerchantPaymentChannels
 * for that circle (via store.loadRelated) and taking the max fiatBalance.
 */
export function updateCircleMaxAllowedBalance(
  circleMetrics: CircleMetrics,
  circleId: Bytes,
): void {
  const merchants = store.loadRelated(
    "Circle",
    circleId.toHexString(),
    "merchants",
  );
  let maxFiat = BigInt.zero();
  let maxUsdc = BigInt.zero();

  // Load Circle to get currency (scalar field - use load, not loadRelated)
  const circle = Circle.load(circleId);
  let sellPrice = BigInt.zero();
  if (circle && !circle.currency.equals(Bytes.empty())) {
    const currencyPrice = CurrencyPrice.load(circle.currency);
    if (currencyPrice) {
      sellPrice = currencyPrice.sellExchangePrice;
    }
  }

  for (let i = 0; i < merchants.length; i++) {
    let totalMerchantFiatBalance = BigInt.zero();

    const merchant = changetype<CircleMerchant>(merchants[i]);
    const paymentChannels = store.loadRelated(
      "CircleMerchant",
      merchant.get("id")!.toBytes().toHexString(),
      "paymentChannels",
    );

    const merchantStakedAmount = merchant.stakedAmount.plus(
      merchant.delegatedStakedAmount,
    );

    const isOnline = merchant.get("isOnline")!.toBoolean();
    const isBlacklisted = merchant.get("isBlacklisted")!.toBoolean();
    const isOngoingOrder = merchant.get("isOngoingOrder")!.toBoolean();

    for (let j = 0; j < paymentChannels.length; j++) {
      const pc = changetype<MerchantPaymentChannels>(paymentChannels[j]);
      const fiatBalance = pc.get("fiatBalance")!.toBigInt();
      const isApproved = pc.get("status")!.toI32() === 2;
      const isActive = pc.get("isActive")!.toBoolean();

      if (
        fiatBalance.gt(maxFiat) &&
        isApproved &&
        isActive &&
        isOnline &&
        !isBlacklisted &&
        !isOngoingOrder
      ) {
        maxFiat = fiatBalance;
      }

      totalMerchantFiatBalance = totalMerchantFiatBalance.plus(fiatBalance);
    }

    // Only compute usdcBalance when sellPrice > 0 to avoid division by zero
    // sellPrice is fiat units per 1 USDC (human); stakedAmount is in 6 decimals.
    // fiatInUsdc = (fiatBalance / sellPrice) * 1e6 to get USDC in 6-decimal units
    if (
      sellPrice.gt(BigInt.zero()) &&
      isOnline &&
      !isBlacklisted &&
      !isOngoingOrder
    ) {
      const USDC_DECIMALS = BigInt.fromI32(1_000_000);
      const fiatInUsdc = totalMerchantFiatBalance
        .times(USDC_DECIMALS)
        .div(sellPrice);
      const usdcBalance = merchantStakedAmount.minus(fiatInUsdc);
      if (usdcBalance.gt(maxUsdc)) {
        maxUsdc = usdcBalance;
      }
    }
  }

  circleMetrics.maxFiatAllowed = maxFiat;
  circleMetrics.maxUsdcAllowed = maxUsdc;
}
