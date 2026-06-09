// P2P stake on-chain state machine (mirrors P2PStakeBoostStorage.StakeStatus)
export const P2P_STAKE_STATUS_NONE: string = "NONE";
export const P2P_STAKE_STATUS_ACTIVE: string = "ACTIVE";
export const P2P_STAKE_STATUS_COOLDOWN: string = "COOLDOWN";
export const P2P_STAKE_STATUS_SEIZED: string = "SEIZED";

// UserP2PStakeActivity.activityType values
export const P2P_ACTIVITY_STAKED: string = "STAKED";
export const P2P_ACTIVITY_TOPPED_UP: string = "TOPPED_UP";
export const P2P_ACTIVITY_UNSTAKE_REQUESTED: string = "UNSTAKE_REQUESTED";
export const P2P_ACTIVITY_UNSTAKE_CANCELLED: string = "UNSTAKE_CANCELLED";
export const P2P_ACTIVITY_UNSTAKE_CLAIMED: string = "UNSTAKE_CLAIMED";
export const P2P_ACTIVITY_COOLDOWN_EXTENDED: string = "COOLDOWN_EXTENDED";
export const P2P_ACTIVITY_SEIZED: string = "SEIZED";
