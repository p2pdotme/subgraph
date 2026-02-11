import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Campaign,
  CampaignManagers,
  CampaignRewardRedeemed,
} from "../../generated/schema";

export function loadCampaign(key: Bytes, event: ethereum.Event): Campaign {
  let campaign = Campaign.load(key);
  if (!campaign) {
    campaign = new Campaign(key);
    campaign.campaignId = BigInt.zero();
    campaign.isActive = false;
    campaign.managersCount = BigInt.zero();
    campaign.claimsCount = BigInt.zero();
    campaign.totalVolume = BigInt.zero();
    campaign.createdAt = BigInt.zero();
  }

  campaign.blockNumber = event.block.number;
  campaign.blockTimestamp = event.block.timestamp;
  campaign.transactionHash = event.transaction.hash;

  return campaign;
}

export function loadCampaignManagers(
  key: Bytes,
  event: ethereum.Event,
): CampaignManagers {
  let campaignManagers = CampaignManagers.load(key);
  if (!campaignManagers) {
    campaignManagers = new CampaignManagers(key);
    campaignManagers.campaign = Bytes.empty();
    campaignManagers.campaignId = BigInt.zero();
    campaignManagers.manager = Bytes.empty();
    campaignManagers.rpReward = BigInt.zero();
    campaignManagers.usdcReward = BigInt.zero();
    campaignManagers.isActive = false;
    campaignManagers.usernameHash = Bytes.empty();
    campaignManagers.claimLimit = BigInt.zero();
    campaignManagers.requiresZk = false;
    campaignManagers.claimsCount = BigInt.zero();
    campaignManagers.totalVolume = BigInt.zero();
  }

  campaignManagers.blockNumber = event.block.number;
  campaignManagers.blockTimestamp = event.block.timestamp;
  campaignManagers.transactionHash = event.transaction.hash;

  return campaignManagers;
}

export function loadCampaignRewardRedeemed(
  key: Bytes,
  event: ethereum.Event,
): CampaignRewardRedeemed {
  let campaignRewardRedeemed = CampaignRewardRedeemed.load(key);
  if (!campaignRewardRedeemed) {
    campaignRewardRedeemed = new CampaignRewardRedeemed(key);
    campaignRewardRedeemed.user = Bytes.empty();
    campaignRewardRedeemed.campaignId = BigInt.zero();
    campaignRewardRedeemed.manager = Bytes.empty();
    campaignRewardRedeemed.usernameHash = Bytes.empty();
    campaignRewardRedeemed.rpReward = BigInt.zero();
    campaignRewardRedeemed.usdcReward = BigInt.zero();
  }

  campaignRewardRedeemed.blockNumber = event.block.number;
  campaignRewardRedeemed.blockTimestamp = event.block.timestamp;
  campaignRewardRedeemed.transactionHash = event.transaction.hash;

  return campaignRewardRedeemed;
}
