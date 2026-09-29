import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CircleCreated as CircleCreatedEvent,
  CircleAdminUpdated as CircleAdminUpdatedEvent,
  CircleCommunityUrlUpdated as CircleCommunityUrlUpdatedEvent,
  CircleAdminCommunityUrlUpdated as CircleAdminCommunityUrlUpdatedEvent,
  // CircleProtocolTokenStaked as CircleProtocolTokenStakedEvent,
  CircleAdminP2PStakeReturned as CircleAdminP2PStakeReturnedEvent,
} from "../generated/CircleFacet/CircleFacet";
import { CircleAdminP2PStakeReturn } from "../generated/schema";
import { loadCircle, loadCircleMetrics } from "./lib";
import { logKey } from "./utils";

export function handleCircleCreated(event: CircleCreatedEvent): void {
  const key = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));

  const circle = loadCircle(key, event);

  circle.circleId = event.params.circleId;
  circle.admin = event.params.admin.toHexString();
  circle.currency = event.params.currency;
  circle.name = event.params.name;
  circle.communityLink = event.params.communityUrl;
  circle.adminLink = event.params.adminCommunityUrl;
  circle.isAutoApprovedPCEnabled = event.params.autoApprovePaymentChannels;

  circle.save();

  // CREATE CIRCLE METRICS
  let circleMetrics = loadCircleMetrics(key, event);

  circleMetrics.circle = circle.id;

  circle.metrics = circleMetrics.id;

  circleMetrics.save();
  circle.save();
}

export function handleCircleAdminUpdated(
  event: CircleAdminUpdatedEvent
): void {
  const key = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(key, event);

  circle.admin = event.params.newAdmin.toHexString();

  circle.save();
}

export function handleCircleCommunityUrlUpdated(
  event: CircleCommunityUrlUpdatedEvent
): void {
  const key = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(key, event);

  circle.communityLink = event.params.newCommunityUrl;

  circle.save();
}

export function handleCircleAdminCommunityUrlUpdated(
  event: CircleAdminCommunityUrlUpdatedEvent
): void {
  const key = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));
  const circle = loadCircle(key, event);

  circle.adminLink = event.params.newAdminCommunityUrl;

  circle.save();
}

// export function handleCircleProtocolTokenStaked(
//   event: CircleProtocolTokenStakedEvent
// ): void {
//   const staker = loadStaker(event.params.staker, event);

//   staker.staker = event.params.staker.toString();

//   staker.totalStaked = staker.totalStaked.plus(event.params.stake);

//   // UPDATE CIRCLE
//   const circle = loadCircle(
//     Bytes.fromHexString(event.params.circleId.toString()),
//     event
//   );

//   const circleStakeRecord = loadCircleUsdcStakeRecords(
//     Bytes.fromHexString(`${event.params.circleId.toString()}-${event.params.staker.toHexString()}`),
//     event
//   );

//   circleStakeRecord.circle = circle.id;
//   circleStakeRecord.staker = staker.id;
//   circleStakeRecord.amount = circleStakeRecord.amount.plus(event.params.stake);
//   staker.circleUsdcStakeRecords.push(circleStakeRecord.id);

//   circleStakeRecord.save();
//   staker.save();

//   // UPDATE CIRCLE METRICS
//   const circleMetrics = loadCircleMetrics(
//     Bytes.fromHexString(event.params.circleId.toString()),
//     event
//   );

//   circleMetrics.totalStaked = circleMetrics.totalStaked.plus(
//     event.params.stake
//   );

//   // IF ADMIN IS STAKING, UPDATE ADMIN STAKE
//   if (circle.admin === event.params.staker.toHexString()) {
//     circleMetrics.adminStaked = circleMetrics.adminStaked.plus(
//       event.params.stake
//     );
//   }

//   circleMetrics.save();
// }

// ─────────────────────────── R1 fund-custody drain ───────────────────────
// `returnCircleAdminP2PStake` hands an admin their whole circle $P2P stake
// back (cancelling any pending unstake first). It is the only exit left once
// circle-admin staking is retired at R7 / removed at R8; the R8 runbook
// enumerates these events against the remaining stake balances.
export function handleCircleAdminP2PStakeReturned(
  event: CircleAdminP2PStakeReturnedEvent,
): void {
  const entity = new CircleAdminP2PStakeReturn(
    logKey(event.transaction.hash, event.logIndex),
  );
  entity.caller = event.params.caller;
  entity.circleAdmin = event.params.circleAdmin;
  entity.amount = event.params.amount;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
