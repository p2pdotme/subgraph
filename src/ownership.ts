import { Bytes } from "@graphprotocol/graph-ts";
import { OwnershipTransferred as OwnershipTransferredEvent } from "../generated/DiamondOwnership/OwnershipFacet";
import { loadDiamondOwnership, newDiamondOwnershipTransfer } from "./lib";

// Diamond ownership (LibDiamond / OwnershipFacet). The R7 cutover moves the
// main Diamond's owner — the only key that can re-cut facets — to DevTimelock
// (plan WS-3.5), so this is where "who controls upgrades" is answered. The
// same handler serves the Insurance Diamond data source: both proxies use the
// same LibDiamond and emit the same event.
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
