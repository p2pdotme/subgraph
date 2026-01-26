import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AadhaarVerified as AadhaarVerifiedEvent,
  OnchainActivityRPUpdated as OnchainActivityRPUpdatedEvent,
  ReputationPointsUpdated as ReputationPointsUpdatedEvent,
  UserBlacklisted as UserBlacklistedEvent,
  UserWhitelisted as UserWhitelistedEvent,
  UserRpUpdatedByAdmin as UserRpUpdatedByAdminEvent,
  SocialVerified as SocialVerifiedEvent,
} from "../generated/ReputationManager/ReputationManager";
import { loadUser, loadSocialVerified, loadReputationChange } from "./lib";

export function handleOnchainActivityRPUpdated(
  event: OnchainActivityRPUpdatedEvent
): void {
  let user = loadUser(event.params.user, event);

  if (event.params.points.gt(BigInt.zero())) {
    user.reputationPoint = user.reputationPoint.plus(event.params.points);
  } else {
    user.reputationPoint = user.reputationPoint.minus(
      event.params.points.abs()
    );
  }

  user.save();
}

export function handleReputationPointsUpdated(
  event: ReputationPointsUpdatedEvent
): void {
  let user = loadUser(event.params.user, event);

  user.address = event.params.user;
  user.reputationPoint = event.params._user.reputationPoints;

  user.save();
}

export function handleUserBlacklisted(event: UserBlacklistedEvent): void {
  let user = loadUser(event.params.user, event);

  user.address = event.params.user;
  user.isBlacklisted = true;

  user.save();
}

export function handleUserWhitelisted(event: UserWhitelistedEvent): void {
  let user = loadUser(event.params.contractAddress, event);

  user.address = event.params.contractAddress;
  user.isBlacklisted = false;

  user.save();
}

export function handleUserRpUpdatedByAdmin(
  event: UserRpUpdatedByAdminEvent
): void {
  let reputationChange = loadReputationChange(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
    event
  );

  reputationChange.admin = event.params.admin;
  reputationChange.user = event.params.user;
  reputationChange.rpChange = event.params.rpChange;

  reputationChange.save();
}

function _onSocialVerified(
  userAddress: Bytes,
  socialName: string,
  verified: boolean,
  timestamp: BigInt,
  event: ethereum.Event
): void {
  // Load or create user
  let user = loadUser(userAddress, event);
  user.address = userAddress;

  // Create social verified entity with unique ID
  let socialVerifiedId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let socialVerified = loadSocialVerified(socialVerifiedId, event);

  socialVerified.socialName = socialName;
  socialVerified.user = user.id;
  socialVerified.verified = verified;
  socialVerified.timestamp = timestamp;

  socialVerified.save();
  user.save();
}

export function handleSocialVerified(event: SocialVerifiedEvent): void {
  _onSocialVerified(
    event.params.user,
    event.params.socialName,
    event.params.verified,
    event.params.timestamp,
    event
  );
}

export function handleAadhaarVerified(event: AadhaarVerifiedEvent): void {
  _onSocialVerified(
    event.params.user,
    "Aadhaar",
    event.params.verified,
    event.params.timestamp,
    event
  );
}
