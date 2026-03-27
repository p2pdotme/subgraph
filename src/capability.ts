import { Bytes } from "@graphprotocol/graph-ts";
import {
  PermissionGranted as PermissionGrantedEvent,
  PermissionRevoked as PermissionRevokedEvent,
} from "../generated/CapabilityFacet/CapabilityFacet";
import { loadCirclePermission } from "./lib";

function containsSelector(selectors: Bytes[], selector: Bytes): boolean {
  for (let i = 0; i < selectors.length; i++) {
    if (selectors[i].equals(selector)) {
      return true;
    }
  }
  return false;
}

function removeSelector(selectors: Bytes[], selector: Bytes): Bytes[] {
  const result: Bytes[] = [];
  for (let i = 0; i < selectors.length; i++) {
    if (!selectors[i].equals(selector)) {
      result.push(selectors[i]);
    }
  }
  return result;
}

export function handlePermissionGranted(event: PermissionGrantedEvent): void {
  const key = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.account.toHexString()}`,
  );

  const permission = loadCirclePermission(key, event);
  permission.circleId = event.params.circleId;
  permission.account = event.params.account;

  permission.name = event.params.name;

  const selector = changetype<Bytes>(event.params.selector);
  const current = permission.selectors;
  if (!containsSelector(current, selector)) {
    const updated = current;
    updated.push(selector);
    permission.selectors = updated;
  }

  permission.save();
}

export function handlePermissionRevoked(event: PermissionRevokedEvent): void {
  const key = Bytes.fromHexString(
    `${event.params.circleId.toString()}-${event.params.account.toHexString()}`,
  );

  const permission = loadCirclePermission(key, event);
  permission.circleId = event.params.circleId;
  permission.account = event.params.account;

  const selector = changetype<Bytes>(event.params.selector);
  const current = permission.selectors;
  if (containsSelector(current, selector)) {
    permission.selectors = removeSelector(current, selector);
  }

  permission.save();
}
