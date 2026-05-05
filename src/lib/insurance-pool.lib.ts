import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";
import { PIPRefillRequest } from "../../generated/schema";

export function loadPIPRefillRequest(
  circleId: BigInt,
  event: ethereum.Event,
): PIPRefillRequest {
  const id = Bytes.fromByteArray(Bytes.fromBigInt(circleId));
  let entity = PIPRefillRequest.load(id);

  if (!entity) {
    entity = new PIPRefillRequest(id);
    entity.circleId = circleId;
    entity.circle = id;
    entity.requestedBy = Bytes.empty();
    entity.requestedAmount = BigInt.zero();
    entity.status = 0;
    entity.requestedAt = BigInt.zero();
    entity.resolvedAt = BigInt.zero();
    entity.approvedAmount = BigInt.zero();
  }

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  return entity;
}
