import { Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Currency } from "../../generated/schema";

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
