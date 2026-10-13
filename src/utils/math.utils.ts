import { BigInt } from "@graphprotocol/graph-ts";

// Counters and volumes never go below zero; a reversal of something that was
// never counted (e.g. a completion indexed while the merchant had no circle)
// stops at zero instead.
export function nonNegative(value: BigInt): BigInt {
  return value.lt(BigInt.zero()) ? BigInt.zero() : value;
}
