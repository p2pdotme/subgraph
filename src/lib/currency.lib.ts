import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Currency, CurrencyMetricsByMonth, CurrencyMetricsByDay, LegacyStats } from "../../generated/schema";
import { getYearMonthFromTimestamp, getDayFromTimestamp } from "../utils/date.utils";
import {
  ORDER_TYPE_BUY,
  ORDER_TYPE_SELL,
  ORDER_TYPE_PAY,
} from "../constants/status";

export function loadCurrency(key: Bytes, event: ethereum.Event): Currency {
  let currency = Currency.load(key);
  if (!currency) {
    currency = new Currency(key);
    currency.currency = key;
    currency.isActive = false;
  }

  currency.blockNumber = event.block.number;
  currency.blockTimestamp = event.block.timestamp;
  currency.transactionHash = event.transaction.hash;

  return currency;
}

export function loadCurrencyMetricsByMonth(
  key: Bytes,
  event: ethereum.Event,
): CurrencyMetricsByMonth {
  let metrics = CurrencyMetricsByMonth.load(key);
  if (!metrics) {
    metrics = new CurrencyMetricsByMonth(key);
    metrics.currency = Bytes.empty();
    metrics.month = "";
    metrics.completedBuyOrdersCount = BigInt.zero();
    metrics.completedSellOrdersCount = BigInt.zero();
    metrics.completedPayOrdersCount = BigInt.zero();
    metrics.cancelledBuyOrdersCount = BigInt.zero();
    metrics.cancelledSellOrdersCount = BigInt.zero();
    metrics.cancelledPayOrdersCount = BigInt.zero();
    metrics.totalVolume = BigInt.zero();
  }

  metrics.blockNumber = event.block.number;
  metrics.blockTimestamp = event.block.timestamp;
  metrics.transactionHash = event.transaction.hash;

  return metrics;
}

export function loadCurrencyMetricsByDay(
  key: Bytes,
  event: ethereum.Event,
): CurrencyMetricsByDay {
  let metrics = CurrencyMetricsByDay.load(key);
  if (!metrics) {
    metrics = new CurrencyMetricsByDay(key);
    metrics.currency = Bytes.empty();
    metrics.day = "";
    metrics.completedBuyOrdersCount = BigInt.zero();
    metrics.completedSellOrdersCount = BigInt.zero();
    metrics.completedPayOrdersCount = BigInt.zero();
    metrics.cancelledBuyOrdersCount = BigInt.zero();
    metrics.cancelledSellOrdersCount = BigInt.zero();
    metrics.cancelledPayOrdersCount = BigInt.zero();
    metrics.totalVolume = BigInt.zero();
  }

  metrics.blockNumber = event.block.number;
  metrics.blockTimestamp = event.block.timestamp;
  metrics.transactionHash = event.transaction.hash;

  return metrics;
}

export function loadLegacyStats(
  key: Bytes,
  event: ethereum.Event,
): LegacyStats {
  let stats = LegacyStats.load(key);
  if (!stats) {
    stats = new LegacyStats(key);
    stats.currency = Bytes.empty();
    stats.completedOrdersCount = BigInt.zero();
    stats.cancelledOrdersCount = BigInt.zero();
    stats.disputeCount = BigInt.zero();
    stats.totalVolume = BigInt.zero();
  }

  stats.blockNumber = event.block.number;
  stats.blockTimestamp = event.block.timestamp;
  stats.transactionHash = event.transaction.hash;

  return stats;
}

export function updateCurrencyMetrics(
  currency: Bytes,
  orderType: i32,
  completedDelta: BigInt,
  cancelledDelta: BigInt,
  volumeDelta: BigInt,
  timestamp: BigInt,
  event: ethereum.Event,
): void {
  // Monthly metrics
  const month = getYearMonthFromTimestamp(timestamp);
  const monthKey = Bytes.fromUTF8(
    `${currency.toHexString()}-${month}`,
  );
  const m = loadCurrencyMetricsByMonth(monthKey, event);
  m.currency = currency;
  m.month = month;
  if (orderType === ORDER_TYPE_BUY) {
    m.completedBuyOrdersCount = m.completedBuyOrdersCount.plus(completedDelta);
    m.cancelledBuyOrdersCount = m.cancelledBuyOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_SELL) {
    m.completedSellOrdersCount = m.completedSellOrdersCount.plus(completedDelta);
    m.cancelledSellOrdersCount = m.cancelledSellOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_PAY) {
    m.completedPayOrdersCount = m.completedPayOrdersCount.plus(completedDelta);
    m.cancelledPayOrdersCount = m.cancelledPayOrdersCount.plus(cancelledDelta);
  }
  m.totalVolume = m.totalVolume.plus(volumeDelta);
  m.save();

  // Daily metrics
  const day = getDayFromTimestamp(timestamp);
  const dayKey = Bytes.fromUTF8(
    `${currency.toHexString()}-${day}`,
  );
  const d = loadCurrencyMetricsByDay(dayKey, event);
  d.currency = currency;
  d.day = day;
  if (orderType === ORDER_TYPE_BUY) {
    d.completedBuyOrdersCount = d.completedBuyOrdersCount.plus(completedDelta);
    d.cancelledBuyOrdersCount = d.cancelledBuyOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_SELL) {
    d.completedSellOrdersCount = d.completedSellOrdersCount.plus(completedDelta);
    d.cancelledSellOrdersCount = d.cancelledSellOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_PAY) {
    d.completedPayOrdersCount = d.completedPayOrdersCount.plus(completedDelta);
    d.cancelledPayOrdersCount = d.cancelledPayOrdersCount.plus(cancelledDelta);
  }
  d.totalVolume = d.totalVolume.plus(volumeDelta);
  d.save();
}
