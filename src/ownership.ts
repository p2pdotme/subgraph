import { Bytes } from "@graphprotocol/graph-ts";
import { OwnershipTransferred as OwnershipTransferredEvent } from "../generated/DiamondOwnership/OwnershipFacet";
import { loadDiamondOwnership, newDiamondOwnershipTransfer } from "./lib";

// Diamond ownership (LibDiamond / OwnershipFacet). The owner is the only key
// that can re-cut facets, so this is where "who controls upgrades" is answered.
// R7 WS-3.5 moves it to the DevTimelock on ALL THREE Diamonds — main,
// Insurance and Governance — because diamondCut is owner-gated on each and each
// carries its own owner, making the cutover three transactions rather than one.
// One handler serves all three data sources: the proxies share LibDiamond and
// emit the same event, and rows are keyed by the emitting address, so the three
// never collide. A `DiamondOwnership` row missing for one of them means that
// Diamond has emitted no transfer yet, not that it is unowned.
export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent,
): void {
  const diamond = changetype<Bytes>(event.address);

  const ownership = loadDiamondOwnership(diamond, event);
  ownership.previousOwner = event.params.previousOwner;
  ownership.owner = event.params.newOwner;
  ownership.transferredAt = event.block.timestamp;
  ownership.transferCount += 1;
  ownership.save();

  newDiamondOwnershipTransfer(
    event,
    diamond,
    event.params.previousOwner,
    event.params.newOwner,
  ).save();
}
