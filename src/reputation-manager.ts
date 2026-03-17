import { BigInt, ByteArray, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  AadhaarVerified as AadhaarVerifiedEvent,
  OnchainActivityRPUpdated as OnchainActivityRPUpdatedEvent,
  ReputationPointsUpdated as ReputationPointsUpdatedEvent,
  UserBlacklisted as UserBlacklistedEvent,
  UserWhitelisted as UserWhitelistedEvent,
  UserRpUpdatedByAdmin as UserRpUpdatedByAdminEvent,
  SocialVerified as SocialVerifiedEvent,
  MerchantReferralClaimed as MerchantReferralClaimedEvent,
  MerchantReferralRevenueClaimed as MerchantReferralRevenueClaimedEvent,
  CampaignCreated as CampaignCreatedEvent,
  ManagerAddedOrUpdated as ManagerAddedOrUpdatedEvent,
  ManagerAddedOrUpdated1 as ManagerAddedOrUpdatedWithHashEvent,
  ManagerAddedOrUpdated2 as ManagerAddedOrUpdatedWithHashAndClaimLimitEvent,
  CampaignToggled as CampaignToggledEvent,
  RewardClaimed as RewardClaimedEvent,
  RewardClaimed1 as RewardClaimedWithHashEvent,
  UserVoted as UserVotedEvent,
} from "../generated/ReputationManager/ReputationManager";
import { CampaignRewardRedeemed } from "../generated/schema";
import {
  loadUser,
  loadSocialVerified,
  loadReputationChange,
  loadMerchantReferralClaimed,
  loadMerchantReferralRevenueClaimed,
  loadCircleMerchant,
} from "./lib";
import {
  loadCampaign,
  loadCampaignManagers,
  loadCampaignRewardRedeemed,
} from "./lib/campaign.lib";
import { loadUserRecommendation } from "./lib/user.lib";

export function handleOnchainActivityRPUpdated(
  event: OnchainActivityRPUpdatedEvent,
): void {
  // No-op: reputationPoint is already correctly set by
  // handleReputationPointsUpdated which fires from _updateUserRp()
  // in the same transaction. Modifying RP here would double-count.
}

export function handleReputationPointsUpdated(
  event: ReputationPointsUpdatedEvent,
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
  event: UserRpUpdatedByAdminEvent,
): void {
  let reputationChange = loadReputationChange(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
    event,
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
  event: ethereum.Event,
): void {
  // Load or create user
  let user = loadUser(userAddress, event);
  user.address = userAddress;

  // Create social verified entity with unique ID
  let socialVerifiedId = event.transaction.hash.concatI32(
    event.logIndex.toI32(),
  );
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
    event,
  );
}

export function handleAadhaarVerified(event: AadhaarVerifiedEvent): void {
  _onSocialVerified(
    event.params.user,
    "Aadhaar",
    event.params.verified,
    event.params.timestamp,
    event,
  );
}

export function handleMerchantReferralClaimed(
  event: MerchantReferralClaimedEvent,
): void {
  let entity = loadMerchantReferralClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
    event,
  );

  entity.recommender = event.params.recommender;
  entity.recipient = event.params.recipient;

  entity.save();
}

export function handleMerchantReferralRevenueClaimed(
  event: MerchantReferralRevenueClaimedEvent,
): void {
  let merchant = loadCircleMerchant(
    Bytes.fromHexString(event.params.merchant.toHexString()),
    event,
  );
  if (merchant == null) {
    return;
  }

  let entity = loadMerchantReferralRevenueClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
    event,
  );

  entity.merchant = merchant.id;
  entity.yearMonthKey = event.params.yearMonthKey;
  entity.reward = event.params.reward;

  entity.save();
}

export function handleCampaignCreated(event: CampaignCreatedEvent): void {
  let key = changetype<Bytes>(Bytes.fromBigInt(event.params.campaignId));
  let campaign = loadCampaign(key, event);

  campaign.campaignId = event.params.campaignId;
  campaign.isActive = true;
  campaign.createdAt = event.block.timestamp;

  campaign.save();
}

function _handleManagerAddedOrUpdated(
  campaignId: BigInt,
  manager: Bytes,
  rpReward: BigInt,
  usdcReward: BigInt,
  isActive: boolean,
  event: ethereum.Event,
  usernameHash: Bytes | null = null,
  claimLimit: BigInt | null = null,
  requiresZk: boolean = false,
): void {
  let id = Bytes.fromUTF8(campaignId.toString() + "-" + manager.toHex());
  let campaignManager = loadCampaignManagers(id, event);

  const campaignKey = changetype<Bytes>(
    Bytes.fromByteArray(ByteArray.fromBigInt(campaignId)),
  );
  const campaign = loadCampaign(campaignKey, event);

  // If the manager is new, increment the managers count
  if (campaignManager.campaign!.equals(Bytes.empty())) {
    campaign.managersCount = campaign.managersCount.plus(BigInt.fromI32(1));
    campaign.save();
  }

  campaignManager.campaignId = campaignId;
  campaignManager.manager = manager;
  campaignManager.rpReward = rpReward;
  campaignManager.usdcReward = usdcReward;
  campaignManager.isActive = isActive;
  campaignManager.requiresZk = requiresZk;

  if (usernameHash !== null) {
    campaignManager.usernameHash = changetype<Bytes>(usernameHash);
  }
  if (claimLimit !== null) {
    campaignManager.claimLimit = claimLimit;
  }

  campaignManager.campaign = campaign.id;

  campaignManager.save();
}

export function handleManagerAddedOrUpdated(
  event: ManagerAddedOrUpdatedEvent,
): void {
  _handleManagerAddedOrUpdated(
    event.params.campaignId,
    event.params.manager,
    event.params.rpReward,
    event.params.usdcReward,
    event.params.active,
    event,
    null,
  );
}

export function handleManagerAddedOrUpdatedWithHash(
  event: ManagerAddedOrUpdatedWithHashEvent,
): void {
  _handleManagerAddedOrUpdated(
    event.params.campaignId,
    event.params.manager,
    event.params.rpReward,
    event.params.usdcReward,
    event.params.active,
    event,
    event.params.usernameHash,
  );
}

export function handleManagerAddedOrUpdatedWithHashAndClaimLimit(
  event: ManagerAddedOrUpdatedWithHashAndClaimLimitEvent,
): void {
  _handleManagerAddedOrUpdated(
    event.params.campaignId,
    event.params.manager,
    event.params.rpReward,
    event.params.usdcReward,
    event.params.active,
    event,
    event.params.usernameHash,
    event.params.claimLimit,
    event.params.requiresZk,
  );
}

export function handleCampaignToggled(event: CampaignToggledEvent): void {
  let key = changetype<Bytes>(Bytes.fromBigInt(event.params.campaignId));
  let campaign = loadCampaign(key, event);

  campaign.isActive = event.params.isActive;
  campaign.save();
}

function _handleRewardClaimedCore(
  campaignId: BigInt,
  userAddress: Bytes,
  rpReward: BigInt,
  usdcReward: BigInt,
  manager: Bytes,
  event: ethereum.Event,
): CampaignRewardRedeemed {
  let claimId = Bytes.fromUTF8(
    campaignId.toString() + "-" + userAddress.toHex(),
  );
  let claimEntity = loadCampaignRewardRedeemed(claimId, event);

  claimEntity.campaignId = campaignId;
  claimEntity.rpReward = rpReward;
  claimEntity.usdcReward = usdcReward;
  claimEntity.manager = manager;

  let user = loadUser(userAddress, event);
  user.address = userAddress;
  claimEntity.user = user.id;

  let campaignClaims = user.campaignClaims;
  if (campaignClaims == null) {
    campaignClaims = [];
  }
  campaignClaims.push(claimEntity.id);
  user.campaignClaims = campaignClaims;
  user.save();

  let campaignKey = changetype<Bytes>(
    Bytes.fromByteArray(ByteArray.fromBigInt(campaignId)),
  );
  let campaign = loadCampaign(campaignKey, event);
  campaign.claimsCount = campaign.claimsCount.plus(BigInt.fromI32(1));
  campaign.save();

  let campaignManagersKey = Bytes.fromUTF8(
    campaignId.toString() + "-" + manager.toHex(),
  );
  let campaignManagers = loadCampaignManagers(campaignManagersKey, event);
  campaignManagers.claimsCount = campaignManagers.claimsCount.plus(
    BigInt.fromI32(1),
  );
  campaignManagers.save();

  return claimEntity;
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
  let entity = _handleRewardClaimedCore(
    event.params.campaignId,
    event.params.user,
    event.params.rp,
    event.params.usdc,
    event.params.manager,
    event,
  );

  entity.save();
}

export function handleRewardClaimedWithHash(
  event: RewardClaimedWithHashEvent,
): void {
  let entity = _handleRewardClaimedCore(
    event.params.campaignId,
    event.params.user,
    event.params.rp,
    event.params.usdc,
    event.params.manager,
    event,
  );

  entity.usernameHash = event.params.usernameHash;

  entity.save();
}

export function handleUserVoted(event: UserVotedEvent): void {
  const key = Bytes.fromUTF8(
    event.params.voter.toHex() + "-" + event.params.votedUser.toHex(),
  );
  let userRecommendation = loadUserRecommendation(key, event);

  userRecommendation.recommender = event.params.voter;
  userRecommendation.recipient = event.params.votedUser;
  userRecommendation.timestamp = event.block.timestamp;
  userRecommendation.save();

  let user = loadUser(event.params.votedUser, event);
  if (user.primaryRecommender.equals(Bytes.empty())) {
    user.primaryRecommender = event.params.voter;
  }
  user.save();
}
