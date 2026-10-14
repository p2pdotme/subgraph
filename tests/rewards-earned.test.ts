import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  MerchantRewardAllocated,
  MerchantRewardClaimed,
} from "../generated/RewardsFacet/RewardsFacet";
import {
  handleMerchantRewardAllocated,
  handleMerchantRewardClaimed,
} from "../src/rewards";

const MERCHANT = Address.fromString(
  "0x0592bc1bf2030709155b178dbba60995ac7c5eab",
);

function accountRewards(
  locked: i32,
  nextLocked: i32,
  claimable: i32,
): ethereum.Tuple {
  const t = new ethereum.Tuple();
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(locked)));
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(nextLocked)));
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(claimable)));
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero())); // withdrawnRewards
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero())); // lastUpdatedCycleStart
  return t;
}

function params(
  e: ethereum.Event,
  amount: i32,
  rewards: ethereum.Tuple,
): void {
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(MERCHANT)),
  );
  e.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount)),
    ),
  );
  e.parameters.push(
    new ethereum.EventParam("accountRewards", ethereum.Value.fromTuple(rewards)),
  );
}

function allocated(
  locked: i32,
  nextLocked: i32,
  claimable: i32,
): MerchantRewardAllocated {
  const e = changetype<MerchantRewardAllocated>(newMockEvent());
  params(e, 0, accountRewards(locked, nextLocked, claimable));
  return e;
}

function claimed(amount: i32): MerchantRewardClaimed {
  const e = changetype<MerchantRewardClaimed>(newMockEvent());
  params(e, amount, accountRewards(0, 0, 0));
  return e;
}

describe("earnedRewards", () => {
  afterEach(() => {
    clearStore();
  });

  test("an allocation without a claim updates earnedRewards", () => {
    // Mainnet: 0x0592bc1b… shows earnedRewards 0 with 4337669 claimable.
    handleMerchantRewardAllocated(allocated(0, 0, 4337669));

    assert.fieldEquals("MerchantRewards", MERCHANT.toHexString(), "earnedRewards", "4337669");
  });

  test("earned = withdrawn + claimable + locked across claim and allocation", () => {
    handleMerchantRewardAllocated(allocated(100, 50, 200));
    assert.fieldEquals("MerchantRewards", MERCHANT.toHexString(), "earnedRewards", "350");

    handleMerchantRewardClaimed(claimed(200));
    assert.fieldEquals("MerchantRewards", MERCHANT.toHexString(), "earnedRewards", "200");

    handleMerchantRewardAllocated(allocated(10, 0, 0));
    assert.fieldEquals("MerchantRewards", MERCHANT.toHexString(), "earnedRewards", "210");
  });
});
