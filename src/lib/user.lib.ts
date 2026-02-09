import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { User, SocialVerified, ReputationChange, UserRecommendation } from "../../generated/schema";

export function loadUser(key: Bytes, event: ethereum.Event): User {
  let user = User.load(key);
  if (!user) {
    user = new User(key);
    user.address = key;
    user.reputationPoint = BigInt.zero();
    user.isBlacklisted = false;
    user.primaryRecommender = Bytes.empty();
  }

  user.blockNumber = event.block.number;
  user.blockTimestamp = event.block.timestamp;
  user.transactionHash = event.transaction.hash;

  return user;
}

export function loadSocialVerified(
  key: Bytes,
  event: ethereum.Event
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
  event: ethereum.Event
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
  event: ethereum.Event
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
