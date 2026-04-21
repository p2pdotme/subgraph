import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Proposal, Vote } from "../../generated/schema";

export function loadProposal(key: Bytes, event: ethereum.Event): Proposal {
  let proposal = Proposal.load(key);
  if (!proposal) {
    proposal = new Proposal(key);
    proposal.proposalId = BigInt.zero();
    proposal.proposer = Bytes.empty();
    proposal.targets = [];
    proposal.values = [];
    proposal.calldatas = [];
    proposal.description = "";
    proposal.startTimestamp = BigInt.zero();
    proposal.endTimestamp = BigInt.zero();
    proposal.status = "Active";
    proposal.eta = null;
  }

  proposal.blockNumber = event.block.number;
  proposal.blockTimestamp = event.block.timestamp;
  proposal.transactionHash = event.transaction.hash;

  return proposal;
}

export function loadVote(event: ethereum.Event): Vote {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  let vote = Vote.load(id);
  if (!vote) {
    vote = new Vote(id);
    vote.proposalId = BigInt.zero();
    vote.voter = Bytes.empty();
    vote.support = 0;
    vote.votes = BigInt.zero();
    vote.reason = null;
  }

  vote.blockNumber = event.block.number;
  vote.blockTimestamp = event.block.timestamp;
  vote.transactionHash = event.transaction.hash;

  return vote;
}
