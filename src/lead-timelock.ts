import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CallExecuted as CallExecutedEvent,
  CallSalt as CallSaltEvent,
  CallScheduled as CallScheduledEvent,
  Cancelled as CancelledEvent,
  MinDelayChange as MinDelayChangeEvent,
} from "../generated/templates/LeadTimelock/LeadTimelock";
import {
  functionNameOf,
  loadLeadTimelock,
  loadTimelockCall,
  loadTimelockOperation,
} from "./lib";
import {
  TIMELOCK_OP_CANCELLED,
  TIMELOCK_OP_EXECUTED,
  TIMELOCK_OP_PENDING,
} from "./constants/roles";
import { selectorOfCalldata } from "./utils";

// Per-lead OpenZeppelin TimelockController (R7 `LeadTimelock`), instantiated
// as a template when `RoleAdminFacet.setRoleTimelock` binds it to a role.
// One CallScheduled per call in a batch (same operation id, rising index);
// CallExecuted mirrors it one-to-one; Cancelled ends the whole operation.

export function handleCallScheduled(event: CallScheduledEvent): void {
  const timelockAddress = changetype<Bytes>(event.address);
  const operationId = event.params.id;

  const operation = loadTimelockOperation(timelockAddress, operationId, event);
  // Index 0 opens a (re)schedule: OZ emits one CallScheduled per call with a
  // rising index, and a cancelled operation id may be scheduled again with
  // the identical calls (the id hashes them), so the row is reset here.
  const opensSchedule = event.params.index.isZero();
  const firstSighting = operation.callCount == 0;
  if (opensSchedule) {
    operation.status = TIMELOCK_OP_PENDING;
    operation.scheduledAt = event.block.timestamp;
    operation.readyAt = event.block.timestamp.plus(event.params.delay);
    operation.delay = event.params.delay;
    operation.predecessor = event.params.predecessor;
    operation.salt = null;
    operation.executedAt = null;
    operation.cancelledAt = null;
    operation.callCount = 0;
    operation.executedCallCount = 0;
  }
  operation.callCount += 1;
  operation.save();

  const call = loadTimelockCall(
    timelockAddress,
    operationId,
    event.params.index.toI32(),
    event,
  );
  call.target = event.params.target;
  call.value = event.params.value;
  call.data = event.params.data;
  const selector = selectorOfCalldata(event.params.data);
  call.selector = selector;
  call.functionName = selector.length == 4 ? functionNameOf(selector) : "";
  call.executed = false;
  call.executedAt = null;
  call.save();

  if (opensSchedule) {
    const timelock = loadLeadTimelock(timelockAddress, event);
    if (firstSighting) timelock.operationCount += 1;
    timelock.pendingCount += 1;
    timelock.save();
  }
}

export function handleCallSalt(event: CallSaltEvent): void {
  const operation = loadTimelockOperation(
    changetype<Bytes>(event.address),
    event.params.id,
    event,
  );
  operation.salt = event.params.salt;
  operation.save();
}

export function handleCallExecuted(event: CallExecutedEvent): void {
  const timelockAddress = changetype<Bytes>(event.address);
  const operationId = event.params.id;

  const call = loadTimelockCall(
    timelockAddress,
    operationId,
    event.params.index.toI32(),
    event,
  );
  const alreadyExecuted = call.executed;
  call.target = event.params.target;
  call.value = event.params.value;
  call.data = event.params.data;
  call.executed = true;
  call.executedAt = event.block.timestamp;
  call.save();

  const operation = loadTimelockOperation(timelockAddress, operationId, event);
  if (!alreadyExecuted) operation.executedCallCount += 1;
  if (
    operation.status == TIMELOCK_OP_PENDING &&
    operation.executedCallCount >= operation.callCount
  ) {
    operation.status = TIMELOCK_OP_EXECUTED;
    operation.executedAt = event.block.timestamp;

    const timelock = loadLeadTimelock(timelockAddress, event);
    if (timelock.pendingCount > 0) timelock.pendingCount -= 1;
    timelock.save();
  }
  operation.save();
}

export function handleCancelled(event: CancelledEvent): void {
  const timelockAddress = changetype<Bytes>(event.address);
  const operation = loadTimelockOperation(
    timelockAddress,
    event.params.id,
    event,
  );
  if (operation.status == TIMELOCK_OP_PENDING) {
    const timelock = loadLeadTimelock(timelockAddress, event);
    if (timelock.pendingCount > 0) timelock.pendingCount -= 1;
    timelock.save();
  }
  operation.status = TIMELOCK_OP_CANCELLED;
  operation.cancelledAt = event.block.timestamp;
  operation.save();
}

export function handleMinDelayChange(event: MinDelayChangeEvent): void {
  const timelock = loadLeadTimelock(changetype<Bytes>(event.address), event);
  timelock.minDelay = event.params.newDuration;
  timelock.save();
}
