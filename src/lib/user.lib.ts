import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  User,
  SocialVerified,
  ReputationChange,
  UserRecommendation,
} from "../../generated/schema";
import {
  ORDER_TYPE_BUY,
  ORDER_TYPE_SELL,
  ORDER_TYPE_PAY,
} from "../constants/status";

export function loadUser(key: Bytes, event: ethereum.Event): User {
  let user = User.load(key);
  if (!user) {
    user = new User(key);
    user.address = key;
    user.reputationPoint = BigInt.zero();
    user.isBlacklisted = false;
    user.primaryRecommender = Bytes.empty();
    user.firstOrderCompletedAt = BigInt.zero();
    user.firstOrderCompletedCurrency = Bytes.empty();
    user.recentOrderCompletedAt = BigInt.zero();
    user.recentOrderCompletedCurrency = Bytes.empty();
    user.totalVolume = BigInt.zero();
    user.cancelledBuyOrdersCount = BigInt.zero();
    user.cancelledSellOrdersCount = BigInt.zero();
    user.cancelledPayOrdersCount = BigInt.zero();
    user.completedBuyOrdersCount = BigInt.zero();
    user.completedSellOrdersCount = BigInt.zero();
    user.completedPayOrdersCount = BigInt.zero();
  }

  user.blockNumber = event.block.number;
  user.blockTimestamp = event.block.timestamp;
  user.transactionHash = event.transaction.hash;

  return user;
}

export function adjustUserMetricsByOrderType(
  user: User,
  orderType: i32,
  completedDelta: BigInt,
  cancelledDelta: BigInt,
): void {
  if (orderType === ORDER_TYPE_BUY) {
    user.completedBuyOrdersCount =
      user.completedBuyOrdersCount.plus(completedDelta);
    user.cancelledBuyOrdersCount =
      user.cancelledBuyOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_SELL) {
    user.completedSellOrdersCount =
      user.completedSellOrdersCount.plus(completedDelta);
    user.cancelledSellOrdersCount =
      user.cancelledSellOrdersCount.plus(cancelledDelta);
  } else if (orderType === ORDER_TYPE_PAY) {
    user.completedPayOrdersCount =
      user.completedPayOrdersCount.plus(completedDelta);
    user.cancelledPayOrdersCount =
      user.cancelledPayOrdersCount.plus(cancelledDelta);
  }
}

export function loadSocialVerified(
  key: Bytes,
  event: ethereum.Event,
): SocialVerified {
  let socialVerified = SocialVerified.load(key);
  if (!socialVerified) {
    socialVerified = new SocialVerified(key);
    socialVerified.socialName = "";
    socialVerified.verified = false;
    socialVerified.timestamp = BigInt.zero();
  }

  socialVerified.blockNumber = event.block.number;
  socialVerified.blockTimestamp = event.block.timestamp;
  socialVerified.transactionHash = event.transaction.hash;

  return socialVerified;
}

export function loadReputationChange(
  key: Bytes,
  event: ethereum.Event,
): ReputationChange {
  let reputationChange = ReputationChange.load(key);
  if (!reputationChange) {
    reputationChange = new ReputationChange(key);
    reputationChange.admin = Bytes.empty();
    reputationChange.user = Bytes.empty();
    reputationChange.rpChange = BigInt.zero();
  }

  reputationChange.blockNumber = event.block.number;
  reputationChange.blockTimestamp = event.block.timestamp;
  reputationChange.transactionHash = event.transaction.hash;

  return reputationChange;
}

export function loadUserRecommendation(
  key: Bytes,
  event: ethereum.Event,
): UserRecommendation {
  let userRecommendation = UserRecommendation.load(key);
  if (!userRecommendation) {
    userRecommendation = new UserRecommendation(key);
    userRecommendation.recommender = Bytes.empty();
    userRecommendation.recipient = Bytes.empty();
    userRecommendation.timestamp = BigInt.zero();
  }

  userRecommendation.blockNumber = event.block.number;
  userRecommendation.blockTimestamp = event.block.timestamp;
  userRecommendation.transactionHash = event.transaction.hash;

  return userRecommendation;
}
