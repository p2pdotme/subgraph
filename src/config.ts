import {
  BuyPriceUpdated as BuyPriceUpdatedEvent,
  SellPriceUpdated as SellPriceUpdatedEvent,
} from "../generated/P2pConfigFacet/P2pConfigFacet";
import { loadOrCreateCurrencyPrice } from "./lib";

export function handleBuyPriceUpdated(event: BuyPriceUpdatedEvent): void {
  const price = loadOrCreateCurrencyPrice(event.params.currency, event);
  price.buyExchangePrice = event.params.updatedExchangeINRPrice;
  price.save();
}

export function handleSellPriceUpdated(event: SellPriceUpdatedEvent): void {
  const price = loadOrCreateCurrencyPrice(event.params.currency, event);
  price.sellExchangePrice = event.params.updatedExchangeINRPrice;
  price.save();
}
