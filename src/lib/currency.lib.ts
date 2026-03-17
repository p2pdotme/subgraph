import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Currency, CurrencyMetricsByMonth, CurrencyMetricsByDay, LegacyStats } from "../../generated/schema";

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
