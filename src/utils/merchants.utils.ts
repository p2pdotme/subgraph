import { Bytes, ethereum } from "@graphprotocol/graph-ts";
import { AssignedMerchants } from "../../generated/schema";

export function loadAssignedMerchants(
  key: Bytes,
  event: ethereum.Event
): AssignedMerchants {
  let assignedMerchant = AssignedMerchants.load(key);

  if (!assignedMerchant) {
    assignedMerchant = new AssignedMerchants(key);
  }

  assignedMerchant.blockNumber = event.block.number;
  assignedMerchant.blockTimestamp = event.block.timestamp;
  assignedMerchant.transactionHash = event.transaction.hash;

  return assignedMerchant;
}
