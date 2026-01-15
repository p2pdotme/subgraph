import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { MerchantRegistered as MerchantRegisteredEvent } from "../generated/CircleMerchantFacet/CircleMerchantFacet";
import { MerchantRegisteredToCircle as MerchantRegisteredToCircleEvent } from "../generated/MerchantOnboardFacet/MerchantOnboardFacet";
import { loadCircle, loadCircleMerchant, loadCircleMetrics } from "./utils";

export function handleMerchantRegistered(event: MerchantRegisteredEvent): void {
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(circleKey, event);
  const merchant = loadCircleMerchant(Bytes.fromHexString(event.params.merchant.toHexString()), event);

  merchant.circle = circle.id;
  merchant.merchant = event.params.merchant.toHexString();
  merchant.stakedAmount = event.params.stakeAmount;

  merchant.save();
}

export function handleMerchantRegisteredToCircle(event: MerchantRegisteredToCircleEvent): void {
  const circleId = event.params.circleId;
  
  const circleKey = changetype<Bytes>(Bytes.fromBigInt(circleId));
  const circle = loadCircle(circleKey, event);
  const merchant = loadCircleMerchant(Bytes.fromHexString(event.params.merchant.toHexString()), event);

  merchant.circle = circle.id;
  merchant.merchant = event.params.merchant.toHexString();
  merchant.stakedAmount = event.params.stakeAmount;

  merchant.save();

  // UPDATE CIRCLE METRICS
  let circleMetrics = loadCircleMetrics(circle.id, event);

  // UPDATE TOTAL MERCHANTS COUNT
  circleMetrics.totalMerchantsCount = circleMetrics.totalMerchantsCount.plus(BigInt.fromI32(1));

  circleMetrics.save();
}
