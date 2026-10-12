import { Bytes } from "@graphprotocol/graph-ts";
import {
  PaymentChannelConfigChanged,
  CurrencyToggled,
} from "../generated/CountryFacet/CountryFacet";
import { PaymentChannelConfig } from "../generated/schema";
import { loadCurrency } from "./lib";

export function handlePaymentChannelConfigChanged(
  event: PaymentChannelConfigChanged,
): void {
  // Key by paymentChannelId exactly as SetterFacet's PaymentChannelConfigUpdate
  // does, so both events update one row. Bytes.fromI32(id.toI32()) produced a
  // different (4-byte) key for the same config and left duplicate rows.
  const id = changetype<Bytes>(
    Bytes.fromBigInt(event.params.cfg.paymentChannelId),
  );

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
