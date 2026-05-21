import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Integrator } from "../../generated/schema";

export function loadIntegrator(
  address: Bytes,
  event: ethereum.Event,
): Integrator {
  let integrator = Integrator.load(address);

  if (!integrator) {
    integrator = new Integrator(address);
    integrator.address = address;
    integrator.isActive = false;
    integrator.usdcThroughIntegrator = false;
    integrator.proxyImpl = Bytes.empty();
    integrator.totalVolume = BigInt.fromI32(0);
    integrator.activeOrderCount = BigInt.fromI32(0);
    integrator.cancelledOrderCount = BigInt.fromI32(0);
    integrator.callbackFailureCount = BigInt.fromI32(0);
  }

  integrator.blockNumber = event.block.number;
  integrator.blockTimestamp = event.block.timestamp;
  integrator.transactionHash = event.transaction.hash;

  return integrator;
}
