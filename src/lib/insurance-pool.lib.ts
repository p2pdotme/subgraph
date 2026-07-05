import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";
import {
  CALRActivity,
  CircleAdminCALR,
  PIPRefillRequest,
} from "../../generated/schema";

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

export function loadCircleAdminCALR(
  admin: Bytes,
  event: ethereum.Event,
): CircleAdminCALR {
  let calr = CircleAdminCALR.load(admin);

  if (!calr) {
    calr = new CircleAdminCALR(admin);
    calr.admin = admin;
    calr.totalLocked = BigInt.zero();
    calr.totalUnlocked = BigInt.zero();
    calr.totalReverted = BigInt.zero();
    calr.totalSettled = BigInt.zero();
    calr.lastLockExpiresAt = BigInt.zero();
  }

  calr.blockNumber = event.block.number;
  calr.blockTimestamp = event.block.timestamp;
  calr.transactionHash = event.transaction.hash;

  return calr;
}

export function newCALRActivity(
  event: ethereum.Event,
  admin: Bytes,
  activityType: string,
  amount: BigInt,
): CALRActivity {
  const activity = new CALRActivity(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  );
  activity.calr = admin;
  activity.admin = admin;
  activity.activityType = activityType;
  activity.amount = amount;
  activity.timestamp = event.block.timestamp;
  activity.blockNumber = event.block.number;
  activity.blockTimestamp = event.block.timestamp;
  activity.transactionHash = event.transaction.hash;
  return activity;
}
