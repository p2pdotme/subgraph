import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { ProposalCreated as ProposalCreatedEvent } from "../generated/GovernorFacet/GovernorFacet";
import { loadProposal } from "./lib";

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
