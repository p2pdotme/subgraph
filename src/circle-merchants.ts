import { Bytes } from "@graphprotocol/graph-ts";
import { MerchantRegistered as MerchantRegisteredEvent } from "../generated/CircleMerchantFacet/CircleMerchantFacet";
import { loadCircle, loadCircleMerchant } from "./utils";

export function handleMerchantRegistered(event: MerchantRegisteredEvent): void {
  
  const circle = loadCircle(Bytes.fromHexString(event.params.circleId.toString()), event);
  const merchant = loadCircleMerchant(Bytes.fromHexString(event.params.merchant.toHexString()), event);

  merchant.circle = circle.id;
  merchant.merchant = event.params.merchant.toString();
  merchant.stakedAmount = event.params.stakeAmount;

  merchant.save();
}
