import { ethereum, Bytes } from "@graphprotocol/graph-ts";
import {
  BuyPriceUpdated as BuyPriceUpdatedEvent,
  SellPriceUpdated as SellPriceUpdatedEvent,
} from "../generated/P2pConfigFacet/P2pConfigFacet";
import {
  loadCircleMetrics,
  loadOrCreateCurrencyPrice,
  updateCircleMaxAllowedBalance,
} from "./lib";
import { Currency } from "../generated/schema";

function updateCirclesForCurrency(
  currency: Bytes,
  event: ethereum.Event,
): void {
  const currencyEntity = Currency.load(currency);
  if (!currencyEntity) return;

  const circles = currencyEntity.circles;
  if (!circles) return;

  for (let i = 0; i < circles.length; i++) {
    const circleId = circles[i];
    const circleMetrics = loadCircleMetrics(circleId, event);
    updateCircleMaxAllowedBalance(circleMetrics, circleId);
    circleMetrics.save();
  }
}

export function handleBuyPriceUpdated(event: BuyPriceUpdatedEvent): void {
  const price = loadOrCreateCurrencyPrice(event.params.currency, event);
  price.buyExchangePrice = event.params.updatedExchangeINRPrice;
  price.save();

  updateCirclesForCurrency(event.params.currency, event);
}

export function handleSellPriceUpdated(event: SellPriceUpdatedEvent): void {
  const price = loadOrCreateCurrencyPrice(event.params.currency, event);
  price.sellExchangePrice = event.params.updatedExchangeINRPrice;
  price.save();

  updateCirclesForCurrency(event.params.currency, event);
}
