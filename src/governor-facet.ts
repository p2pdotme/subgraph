import { Bytes } from "@graphprotocol/graph-ts";
import {
  ProposalCreated as ProposalCreatedEvent,
  ProposalQueued as ProposalQueuedEvent,
  ProposalExecuted as ProposalExecutedEvent,
  ProposalCanceled as ProposalCanceledEvent,
  VoteCast as VoteCastEvent,
  VoteCastWithReason as VoteCastWithReasonEvent,
} from "../generated/GovernorFacet/GovernorFacet";
import { loadProposal, loadVote } from "./lib";

export function handleProposalCreated(event: ProposalCreatedEvent): void {
  const id = Bytes.fromByteArray(Bytes.fromBigInt(event.params.proposalId));

  const proposal = loadProposal(id, event);
  proposal.proposalId = event.params.proposalId;
  proposal.proposer = event.params.proposer;
  proposal.description = event.params.description;
  proposal.startTimestamp = event.params.startTimestamp;
  proposal.endTimestamp = event.params.endTimestamp;

  const rawTargets = event.params.targets;
  const targets: Bytes[] = [];
  for (let i = 0; i < rawTargets.length; i++) {
    targets.push(changetype<Bytes>(rawTargets[i]));
  }
  proposal.targets = targets;

  proposal.values = event.params.values;
  proposal.calldatas = event.params.calldatas;

  proposal.save();
}

export function handleProposalQueued(event: ProposalQueuedEvent): void {
  const id = Bytes.fromByteArray(Bytes.fromBigInt(event.params.proposalId));
  const proposal = loadProposal(id, event);
  proposal.status = "Queued";
  proposal.eta = event.params.eta;
  proposal.save();
}

export function handleProposalExecuted(event: ProposalExecutedEvent): void {
  const id = Bytes.fromByteArray(Bytes.fromBigInt(event.params.proposalId));
  const proposal = loadProposal(id, event);
  proposal.status = "Executed";
  proposal.save();
}

export function handleProposalCanceled(event: ProposalCanceledEvent): void {
  const id = Bytes.fromByteArray(Bytes.fromBigInt(event.params.proposalId));
  const proposal = loadProposal(id, event);
  proposal.status = "Canceled";
  proposal.save();
}

export function handleVoteCast(event: VoteCastEvent): void {
  const vote = loadVote(event);
  vote.proposalId = event.params.proposalId;
  vote.voter = event.params.voter;
  vote.support = event.params.support;
  vote.votes = event.params.votes;
  vote.save();
}

export function handleVoteCastWithReason(event: VoteCastWithReasonEvent): void {
  const vote = loadVote(event);
  vote.proposalId = event.params.proposalId;
  vote.voter = event.params.voter;
  vote.support = event.params.support;
  vote.votes = event.params.votes;
  vote.reason = event.params.reason;
  vote.save();
}
