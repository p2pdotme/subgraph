import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  OrderPlacementLimitConfig,
  UserDailyPlacements,
} from "../../generated/schema";
import {
  ORDER_TYPE_BUY,
  ORDER_TYPE_PAY,
  ORDER_TYPE_SELL,
} from "../constants/status";
import { getDayNumber } from "./circle.lib";
import { getDayFromTimestamp } from "../utils/date.utils";

/** Singleton key for the placement-limit config entity. */
const PLACEMENT_LIMIT_CONFIG_ID = "placement-limits";

/**
 * Loads (or zero-initializes) the gross placement bucket for a user on the UTC
 * day containing `timestamp`.
 *
 * The day index is `timestamp / 86400`, byte-for-byte the key
 * libOrderProcessorFacet.getDayKey derives on-chain, so a bucket here and the
 * contract's mapping entry always describe the same window.
 */
export function loadUserDailyPlacements(
  user: Bytes,
  event: ethereum.Event,
): UserDailyPlacements {
  const dayIndex = getDayNumber(event.block.timestamp);
  const key = Bytes.fromUTF8(`${user.toHexString()}-${dayIndex.toString()}`);

  let placements = UserDailyPlacements.load(key);
  if (!placements) {
    placements = new UserDailyPlacements(key);
    placements.user = user;
    placements.dayIndex = BigInt.fromI32(dayIndex);
    placements.day = getDayFromTimestamp(event.block.timestamp);
    placements.buyPlacements = BigInt.zero();
    placements.sellPlacements = BigInt.zero();
  }

  placements.blockNumber = event.block.number;
  placements.blockTimestamp = event.block.timestamp;
  placements.transactionHash = event.transaction.hash;

  return placements;
}

/**
 * Records one placement against the user's bucket for the current UTC day.
 *
 * Deliberately has no counterpart on the cancellation handlers: these counters
 * are gross by design, matching `dailyBuyOrdersPlaced` / `dailySellOrdersPlaced`
 * on-chain. SELL and PAY land in the same bucket, again matching the contract.
 */
export function recordPlacement(
  user: Bytes,
  orderType: i32,
  event: ethereum.Event,
): void {
  if (
    orderType != ORDER_TYPE_BUY &&
    orderType != ORDER_TYPE_SELL &&
    orderType != ORDER_TYPE_PAY
  ) {
    return;
  }

  const placements = loadUserDailyPlacements(user, event);

  if (orderType == ORDER_TYPE_BUY) {
    placements.buyPlacements = placements.buyPlacements.plus(BigInt.fromI32(1));
  } else {
    placements.sellPlacements = placements.sellPlacements.plus(
      BigInt.fromI32(1),
    );
  }

  placements.save();
}

/**
 * Loads (or initializes) the placement-limit singleton.
 *
 * Both limits start at zero with their `*Configured` flag false, meaning "not
 * observed yet" rather than "the limit is zero" — a distinction that matters
 * because a sell limit of 0 legitimately means UNLIMITED on-chain.
 */
export function loadOrderPlacementLimitConfig(
  event: ethereum.Event,
): OrderPlacementLimitConfig {
  const key = Bytes.fromUTF8(PLACEMENT_LIMIT_CONFIG_ID);

  let config = OrderPlacementLimitConfig.load(key);
  if (!config) {
    config = new OrderPlacementLimitConfig(key);
    config.dailyBuyOrderPlacementLimit = BigInt.zero();
    config.buyLimitConfigured = false;
    config.dailySellOrderPlacementLimit = BigInt.zero();
    config.sellLimitConfigured = false;
    config.updatedAt = BigInt.zero();
  }

  config.blockNumber = event.block.number;
  config.blockTimestamp = event.block.timestamp;
  config.transactionHash = event.transaction.hash;

  return config;
}
