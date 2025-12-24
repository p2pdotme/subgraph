import { Bytes } from "@graphprotocol/graph-ts";
import {
  CircleCreated as CircleCreatedEvent,
  CircleProtocolTokenStaked as CircleProtocolTokenStakedEvent,
} from "../generated/CircleFacet/CircleFacet";
import {
  loadStaker,
  loadCircle,
  loadCircleMetrics,
  loadStakedOnCircle,
} from "./utils";

export function handleCircleCreated(event: CircleCreatedEvent): void {
  const key = Bytes.fromHexString(event.params.circleId.toString());
  let circle = loadCircle(key, event);

  circle.circleId = event.params.circleId;
  circle.admin = event.params.admin.toString();
  circle.currency = event.params.currency;
  circle.name = event.params.name;
  circle.communityLink = event.params.communityLink;
  circle.isAutoApprovedPCEnabled = event.params.isAutoApprovedPCEnabled;

  // CREATE CIRCLE METRICS
  const circleMetrics = loadCircleMetrics(key, event);

  circleMetrics.circle = circle.id;

  circle.metrics = circleMetrics.id;

  circleMetrics.save();
  circle.save();
}

export function handleCircleProtocolTokenStaked(
  event: CircleProtocolTokenStakedEvent
): void {
  const staker = loadStaker(event.params.staker, event);

  staker.staker = event.params.staker.toString();

  staker.totalStaked = staker.totalStaked.plus(event.params.stake);

  staker.save();

  // UPDATE CIRCLE
  const circle = loadCircle(
    Bytes.fromHexString(event.params.circleId.toString()),
    event
  );

  const circleStaked = loadStakedOnCircle(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
    event
  );

  circleStaked.circle = circle.id;
  circleStaked.staker = staker.id;
  circleStaked.amount = event.params.stake;

  circleStaked.save();

  // UPDATE CIRCLE METRICS
  const circleMetrics = loadCircleMetrics(
    Bytes.fromHexString(event.params.circleId.toString()),
    event
  );

  circleMetrics.totalStaked = circleMetrics.totalStaked.plus(
    event.params.stake
  );

  // IF ADMIN IS STAKING, UPDATE ADMIN STAKE
  if (circle.admin === event.params.staker.toHexString()) {
    circleMetrics.adminStaked = circleMetrics.adminStaked.plus(
      event.params.stake
    );
  }

  circleMetrics.save();
}
