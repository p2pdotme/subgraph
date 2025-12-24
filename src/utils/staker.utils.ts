import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { StakedOnCircle, Staker } from "../../generated/schema";

export function loadStaker(key: Address, event: ethereum.Event): Staker {
  let staker = Staker.load(key);

  if (!staker) {
    staker = new Staker(key);
  }

  staker.blockNumber = event.block.number;
  staker.blockTimestamp = event.block.timestamp;
  staker.transactionHash = event.transaction.hash;

  return staker;
}

export function loadStakedOnCircle(key: Bytes, event: ethereum.Event): StakedOnCircle {
  let stakedOnCircle = StakedOnCircle.load(key);

  if (!stakedOnCircle) {
    stakedOnCircle = new StakedOnCircle(key);
  }

  stakedOnCircle.blockNumber = event.block.number;
  stakedOnCircle.blockTimestamp = event.block.timestamp;
  stakedOnCircle.transactionHash = event.transaction.hash;

  return stakedOnCircle;
}
