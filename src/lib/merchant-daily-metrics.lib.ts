import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { CircleMerchant, MerchantDailyMetrics } from "../../generated/schema";
import { getDayFromTimestamp } from "../utils/date.utils";

const SECONDS_PER_DAY = 86400;

export function loadMerchantDailyMetrics(
  merchant: CircleMerchant,
  timestamp: BigInt,
  event: ethereum.Event,
): MerchantDailyMetrics {
  const dayNumber = timestamp.toI64() / SECONDS_PER_DAY;
  const key = Bytes.fromUTF8(
    `${merchant.id.toHexString()}-${dayNumber.toString()}`,
  );

  let metrics = MerchantDailyMetrics.load(key);
  if (!metrics) {
    metrics = new MerchantDailyMetrics(key);
    metrics.merchant = merchant.id;
    metrics.merchantAddress = merchant.merchant;
    metrics.circleId = merchant.circleId;
    metrics.dayNumber = BigInt.fromI64(dayNumber);
    metrics.date = getDayFromTimestamp(timestamp);
    metrics.assignedCount = BigInt.zero();
    metrics.acceptedCount = BigInt.zero();
    metrics.missedCount = BigInt.zero();
    metrics.completedCount = BigInt.zero();
    metrics.cancelledByMerchantCount = BigInt.zero();
    metrics.acceptToCompleteSecondsSum = BigInt.zero();
    metrics.completedWithSpeedCount = BigInt.zero();
    metrics.usdcVolume = BigInt.zero();
    metrics.merchantFaultDisputes = BigInt.zero();
    metrics.bankFaultDisputes = BigInt.zero();
    metrics.userFaultDisputes = BigInt.zero();
    metrics.onlineSeconds = BigInt.zero();
    metrics.busySeconds = BigInt.zero();
  }

  metrics.blockNumber = event.block.number;
  metrics.blockTimestamp = event.block.timestamp;
  metrics.transactionHash = event.transaction.hash;

  return metrics;
}
