import { Bytes } from "@graphprotocol/graph-ts";
import {
  PaymentChannelConfigChanged,
  CurrencyToggled,
  CountryActiveSet,
  CurrencyCountryBound,
} from "../generated/CountryFacet/CountryFacet";
import { PaymentChannelConfig } from "../generated/schema";
import { loadCountry, loadCurrency } from "./lib";

export function handlePaymentChannelConfigChanged(
  event: PaymentChannelConfigChanged,
): void {
  // Use paymentChannelId as the entity ID
  const id = Bytes.fromI32(event.params.cfg.paymentChannelId.toI32());

  let config = PaymentChannelConfig.load(id);
  if (!config) {
    config = new PaymentChannelConfig(id);
  }

  config.paymentChannelId = event.params.cfg.paymentChannelId;
  config.name = event.params.cfg.name;
  config.dailyVolumeLimit = event.params.cfg.dailyVolumeLimit;
  config.currency = event.params.cfg.currency;
  config.isActive = event.params.cfg.isActive;

  config.blockNumber = event.block.number;
  config.blockTimestamp = event.block.timestamp;
  config.transactionHash = event.transaction.hash;

  config.save();
}

export function handleCurrencyToggled(event: CurrencyToggled): void {
  let currency = loadCurrency(event.params.currency, event);

  currency.isActive = event.params.isActive;

  currency.save();
}

// ─────────────────────────── R5 country scope ────────────────────────────

export function handleCountryActiveSet(event: CountryActiveSet): void {
  const country = loadCountry(event.params.country, event);
  country.isActive = event.params.active;
  country.save();
}

export function handleCurrencyCountryBound(event: CurrencyCountryBound): void {
  // Binding does not require the country to have been activated in an
  // indexed block, so make sure its row exists before linking.
  const country = loadCountry(event.params.country, event);
  country.save();

  const currency = loadCurrency(event.params.currency, event);
  currency.country = country.id;
  currency.save();
}
