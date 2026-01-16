import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CircleCreated as CircleCreatedEvent,
  // CircleProtocolTokenStaked as CircleProtocolTokenStakedEvent,
} from "../generated/CircleFacet/CircleFacet";
import {
  loadStaker,
  loadCircle,
  loadCircleMetrics,
  loadCircleStakeRecords,
} from "./utils";
import { Circle } from "../generated/schema";

export function handleCircleCreated(event: CircleCreatedEvent): void {
  const key = changetype<Bytes>(Bytes.fromBigInt(event.params.circleId));

  const circle = loadCircle(key, event);

  circle.circleId = event.params.circleId;
  circle.admin = event.params.admin.toHexString();
  circle.currency = event.params.currency;
  circle.name = event.params.name;
  circle.communityLink = event.params.communityUrl;
  circle.isAutoApprovedPCEnabled = event.params.autoApprovePaymentChannels;

  circle.save();

  // CREATE CIRCLE METRICS
  let circleMetrics = loadCircleMetrics(key, event);

  circleMetrics.circle = circle.id;

  circle.metrics = circleMetrics.id;

  circleMetrics.save();
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

//   const circleStakeRecord = loadCircleStakeRecords(
//     Bytes.fromHexString(`${event.params.circleId.toString()}-${event.params.staker.toHexString()}`),
//     event
//   );

//   circleStakeRecord.circle = circle.id;
//   circleStakeRecord.staker = staker.id;
//   circleStakeRecord.amount = circleStakeRecord.amount.plus(event.params.stake);
//   staker.circleStakeRecords.push(circleStakeRecord.id);
  
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
