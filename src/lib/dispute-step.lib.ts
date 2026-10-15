import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { DisputeStep, Orders } from "../../generated/schema";

/**
 * Saves one immutable DisputeStep for a ladder event and appends its id to
 * the order's disputeHistory. Fields not relevant to `kind` stay at zero.
 * The caller saves the order.
 */
export function appendDisputeStep(
  order: Orders,
  event: ethereum.Event,
  kind: i32,
  tier: i32,
  fromTier: i32,
  faultType: i32,
  by: Bytes,
  finalizedBy: Bytes,
  deadline: BigInt,
  slaLapsed: boolean,
): void {
  const step = new DisputeStep(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  );
  step.orderId = BigInt.fromByteArray(order.id);
  step.kind = kind;
  step.tier = tier;
  step.fromTier = fromTier;
  step.faultType = faultType;
  step.by = by;
  step.finalizedBy = finalizedBy;
  step.deadline = deadline;
  step.slaLapsed = slaLapsed;
  step.blockNumber = event.block.number;
  step.blockTimestamp = event.block.timestamp;
  step.transactionHash = event.transaction.hash;
  step.save();

  order.disputeHistory = order.disputeHistory.concat([step.id]);
}
