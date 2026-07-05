import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  InsuranceDebtAccrued as InsuranceDebtAccruedEvent,
  InsuranceDebtRepaid as InsuranceDebtRepaidEvent,
  InsuranceDebtRepaidDirect as InsuranceDebtRepaidDirectEvent,
  MerchantPcFiatUpdated as MerchantPcFiatUpdatedEvent,
  CircleAdminClaimableRewardsCredited as CircleAdminClaimableRewardsCreditedEvent,
} from "../generated/InsuranceSinkFacet/InsuranceSinkFacet";
import { InsuranceDebtActivity } from "../generated/schema";
import {
  loadCircleAdminCALR,
  loadCircleAdminRewards,
  loadMerchantPaymentChannels,
  newCALRActivity,
  savePaymentChannel,
} from "./lib";

function pcKeyFor(merchant: Bytes, accountNo: BigInt): Bytes {
  return Bytes.fromUTF8(`${merchant.toHexString()}-${accountNo.toString()}`);
}

function newDebtActivity(
  event: ethereum.Event,
  activityType: string,
): InsuranceDebtActivity {
  const key = event.transaction.hash.concatI32(event.logIndex.toI32());
  const activity = new InsuranceDebtActivity(key);
  activity.activityType = activityType;
  activity.claimId = null;
  activity.amountFiat = BigInt.zero();
  activity.surplusToFreeFiat = BigInt.zero();
  activity.usdcPaid = BigInt.zero();
  activity.debtAfter = BigInt.zero();
  activity.timestamp = event.block.timestamp;
  activity.blockNumber = event.block.number;
  activity.blockTimestamp = event.block.timestamp;
  activity.transactionHash = event.transaction.hash;
  return activity;
}

export function handleInsuranceDebtAccrued(
  event: InsuranceDebtAccruedEvent,
): void {
  const merchant = event.params.merchant;
  const accountNo = event.params.accountNo;
  const pcKey = pcKeyFor(merchant, accountNo);

  const paymentChannel = loadMerchantPaymentChannels(pcKey, event);
  paymentChannel.merchant = merchant;
  paymentChannel.accountNo = accountNo;
  const accrued = paymentChannel.insuranceDebt.plus(event.params.residualFiat);
  paymentChannel.insuranceDebt = accrued;
  savePaymentChannel(paymentChannel);

  const activity = newDebtActivity(event, "ACCRUED");
  activity.paymentChannel = pcKey;
  activity.merchant = merchant;
  activity.accountNo = accountNo;
  activity.claimId = event.params.claimId;
  activity.amountFiat = event.params.residualFiat;
  activity.debtAfter = accrued;
  activity.save();
}

export function handleInsuranceDebtRepaid(
  event: InsuranceDebtRepaidEvent,
): void {
  const merchant = event.params.merchant;
  const accountNo = event.params.accountNo;
  const pcKey = pcKeyFor(merchant, accountNo);

  const paymentChannel = loadMerchantPaymentChannels(pcKey, event);
  paymentChannel.merchant = merchant;
  paymentChannel.accountNo = accountNo;
  const repaid = event.params.repaidFiat;
  const debtBefore = paymentChannel.insuranceDebt;
  const remaining = debtBefore.ge(repaid)
    ? debtBefore.minus(repaid)
    : BigInt.zero();
  paymentChannel.insuranceDebt = remaining;
  savePaymentChannel(paymentChannel);

  const activity = newDebtActivity(event, "REPAID");
  activity.paymentChannel = pcKey;
  activity.merchant = merchant;
  activity.accountNo = accountNo;
  activity.amountFiat = repaid;
  activity.surplusToFreeFiat = event.params.surplusToFreeFiat;
  activity.debtAfter = remaining;
  activity.save();
}

export function handleInsuranceDebtRepaidDirect(
  event: InsuranceDebtRepaidDirectEvent,
): void {
  const merchant = event.params.merchant;
  const accountNo = event.params.accountNo;
  const pcKey = pcKeyFor(merchant, accountNo);

  const paymentChannel = loadMerchantPaymentChannels(pcKey, event);
  paymentChannel.merchant = merchant;
  paymentChannel.accountNo = accountNo;
  const repaid = event.params.repaidFiat;
  const debtBefore = paymentChannel.insuranceDebt;
  const remaining = debtBefore.ge(repaid)
    ? debtBefore.minus(repaid)
    : BigInt.zero();
  paymentChannel.insuranceDebt = remaining;
  savePaymentChannel(paymentChannel);

  const activity = newDebtActivity(event, "REPAID_DIRECT");
  activity.paymentChannel = pcKey;
  activity.merchant = merchant;
  activity.accountNo = accountNo;
  activity.amountFiat = repaid;
  activity.usdcPaid = event.params.usdcPaid;
  activity.debtAfter = remaining;
  activity.save();
}

// Authoritative post-write-off snapshot. The insurance write-off path reduces
// the PC's on-chain `freeFiatAmount` (and accrues debt on deficit) but emits no
// `Merchant` balance event, so without this the indexed `fiatBalance` would go
// stale after a claim. Set both fields directly from the emitted resolved state.
export function handleMerchantPcFiatUpdated(
  event: MerchantPcFiatUpdatedEvent,
): void {
  const merchant = event.params.merchant;
  const accountNo = event.params.accountNo;
  const pcKey = pcKeyFor(merchant, accountNo);

  const paymentChannel = loadMerchantPaymentChannels(pcKey, event);
  paymentChannel.merchant = merchant;
  paymentChannel.accountNo = accountNo;
  paymentChannel.fiatBalance = event.params.freeFiat;
  paymentChannel.insuranceDebt = event.params.insuranceDebt;
  savePaymentChannel(paymentChannel);
}

// Main-side leg of a CALR unlock: the Insurance Diamond has returned USDC and
// credited the admin's claimable rewards. Mirror the exact on-chain mutation
// (claimableRewards += amount); the next struct-carrying RewardsFacet event
// overwrites with authoritative state, so any drift self-corrects.
export function handleCircleAdminClaimableRewardsCredited(
  event: CircleAdminClaimableRewardsCreditedEvent,
): void {
  const admin = event.params.admin;

  const rewards = loadCircleAdminRewards(
    Bytes.fromHexString(admin.toHexString()),
    event,
  );
  rewards.admin = admin.toHexString();
  rewards.claimableRewards = rewards.claimableRewards.plus(event.params.amount);
  rewards.save();

  // Keep the CALR aggregate's last-touched block fields fresh and record the
  // credit on the same activity timeline as the insurance-side events.
  loadCircleAdminCALR(admin, event).save();
  newCALRActivity(event, admin, "CLAIMABLE_CREDITED", event.params.amount).save();
}
