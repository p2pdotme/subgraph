import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Currency, MonthlyVolumeLimit } from "../../generated/schema";

export function loadCurrency(key: Bytes, event: ethereum.Event): Currency {
  let currency = Currency.load(key);
  if (!currency) {
    currency = new Currency(key);
    currency.currency = key;
    currency.circles = [];
    currency.isActive = false;
  }

  currency.blockNumber = event.block.number;
  currency.blockTimestamp = event.block.timestamp;
  currency.transactionHash = event.transaction.hash;

  return currency;
}

export function loadMonthlyVolumeLimit(
  key: Bytes,
  event: ethereum.Event,
): MonthlyVolumeLimit {
  let monthlyVolumeLimit = MonthlyVolumeLimit.load(key);
  if (!monthlyVolumeLimit) {
    monthlyVolumeLimit = new MonthlyVolumeLimit(key);
    monthlyVolumeLimit.currency = key;
    monthlyVolumeLimit.limit = BigInt.zero();
  }

  monthlyVolumeLimit.blockNumber = event.block.number;
  monthlyVolumeLimit.blockTimestamp = event.block.timestamp;
  monthlyVolumeLimit.transactionHash = event.transaction.hash;

  return monthlyVolumeLimit;
}
