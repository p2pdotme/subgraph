import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  IntegratorRegistered as IntegratorRegisteredEvent,
  IntegratorDeactivated as IntegratorDeactivatedEvent,
  B2BOrderPlaced as B2BOrderPlacedEvent,
  B2BSellOrderPlaced as B2BSellOrderPlacedEvent,
  B2BOrderCompleted as B2BOrderCompletedEvent,
  B2BOrderCancelled as B2BOrderCancelledEvent,
} from "../generated/B2BGatewayFacet/B2BGatewayFacet";
import { B2BOrder } from "../generated/schema";
import { loadIntegrator } from "./lib/b2b-gateway.lib";
import { ORDER_TYPE_BUY, ORDER_TYPE_SELL } from "./constants/status";

// ─── Integrator Registration ──────────────────────────────────────

export function handleIntegratorRegistered(
  event: IntegratorRegisteredEvent,
): void {
  let integrator = loadIntegrator(event.params.integrator, event);
  integrator.isActive = true;
  integrator.usdcThroughIntegrator = event.params.usdcThroughIntegrator;
  integrator.proxyImpl = event.params.proxyImpl;
  integrator.save();
}

export function handleIntegratorDeactivated(
  event: IntegratorDeactivatedEvent,
): void {
  let integrator = loadIntegrator(event.params.integrator, event);
  integrator.isActive = false;
  integrator.save();
}

// ─── B2B Order Lifecycle ──────────────────────────────────────────

export function handleB2BOrderPlaced(event: B2BOrderPlacedEvent): void {
  // BUY: increment activeOrderCount and totalVolume.
  let integrator = loadIntegrator(event.params.integrator, event);
  integrator.totalVolume = integrator.totalVolume.plus(event.params.amount);
  integrator.activeOrderCount = integrator.activeOrderCount.plus(
    BigInt.fromI32(1),
  );
  integrator.save();

  let orderKey = Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId));
  let b2bOrder = new B2BOrder(orderKey);
  b2bOrder.orderId = event.params.orderId;
  b2bOrder.integrator = event.params.integrator;
  b2bOrder.user = event.params.user;
  b2bOrder.amount = event.params.amount;
  b2bOrder.orderType = ORDER_TYPE_BUY;
  b2bOrder.blockNumber = event.block.number;
  b2bOrder.blockTimestamp = event.block.timestamp;
  b2bOrder.transactionHash = event.transaction.hash;
  b2bOrder.save();
}

export function handleB2BSellOrderPlaced(event: B2BSellOrderPlacedEvent): void {
  // SELL: only volume tracking — gateway does not bookkeep activeOrderCount
  // for SELL, mirroring B2BGatewayFacet.placeB2BSellOrder.
  let integrator = loadIntegrator(event.params.integrator, event);
  integrator.totalVolume = integrator.totalVolume.plus(event.params.amount);
  integrator.save();

  let orderKey = Bytes.fromByteArray(Bytes.fromBigInt(event.params.orderId));
  let b2bOrder = new B2BOrder(orderKey);
  b2bOrder.orderId = event.params.orderId;
  b2bOrder.integrator = event.params.integrator;
  b2bOrder.user = event.params.user;
  b2bOrder.amount = event.params.amount;
  b2bOrder.orderType = ORDER_TYPE_SELL;
  b2bOrder.blockNumber = event.block.number;
  b2bOrder.blockTimestamp = event.block.timestamp;
  b2bOrder.transactionHash = event.transaction.hash;
  b2bOrder.save();
}

export function handleB2BOrderCompleted(event: B2BOrderCompletedEvent): void {
  // Only fired for BUY orders by B2BGatewayFacet.onB2BOrderComplete.
  let integrator = loadIntegrator(event.params.integrator, event);
  if (integrator.activeOrderCount.gt(BigInt.fromI32(0))) {
    integrator.activeOrderCount = integrator.activeOrderCount.minus(
      BigInt.fromI32(1),
    );
  }
  integrator.save();
}

export function handleB2BOrderCancelled(event: B2BOrderCancelledEvent): void {
  // Only fired for BUY orders by B2BGatewayFacet.onB2BOrderCancelled
  // (wired from OrderFlowFacet._cancelOrder for BUY-type B2B orders).
  let integrator = loadIntegrator(event.params.integrator, event);
  if (integrator.activeOrderCount.gt(BigInt.fromI32(0))) {
    integrator.activeOrderCount = integrator.activeOrderCount.minus(
      BigInt.fromI32(1),
    );
  }
  integrator.cancelledOrderCount = integrator.cancelledOrderCount.plus(
    BigInt.fromI32(1),
  );
  integrator.save();
}
