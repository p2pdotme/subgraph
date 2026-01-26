import { Bytes } from "@graphprotocol/graph-ts";
import { PaymentChannelConfigChanged } from "../generated/CountryFacet/CountryFacet";
import { PaymentChannelConfig } from "../generated/schema";

export function handlePaymentChannelConfigChanged(
  event: PaymentChannelConfigChanged
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
