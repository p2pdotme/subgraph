import { Bytes, ethereum, BigInt } from "@graphprotocol/graph-ts";
import { CurrencyPrice } from "../../generated/schema";

export function loadOrCreateCurrencyPrice(
  currency: Bytes,
  event: ethereum.Event,
): CurrencyPrice {
  let price = CurrencyPrice.load(currency);
  if (!price) {
    price = new CurrencyPrice(currency);
    price.currency = currency;
    price.buyExchangePrice = BigInt.zero();
    price.sellExchangePrice = BigInt.zero();
  }
  price.blockNumber = event.block.number;
  price.blockTimestamp = event.block.timestamp;
  price.transactionHash = event.transaction.hash;
  return price;
}
