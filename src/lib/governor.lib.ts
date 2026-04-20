import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Proposal } from "../../generated/schema";

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
  }

  proposal.blockNumber = event.block.number;
  proposal.blockTimestamp = event.block.timestamp;
  proposal.transactionHash = event.transaction.hash;

  return proposal;
}
