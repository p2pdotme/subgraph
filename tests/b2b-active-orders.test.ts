import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  B2BOrderCancelled,
  B2BOrderCompleted,
  B2BOrderPlaced,
} from "../generated/B2BGatewayFacet/B2BGatewayFacet";
import {
  handleB2BOrderCancelled,
  handleB2BOrderCompleted,
  handleB2BOrderPlaced,
} from "../src/b2b-gateway";

const INTEGRATOR = Address.fromString(
  "0xdd84142700000000000000000000000000000000",
);
const USER = Address.fromString("0x00000000000000000000000000000000000000bb");

function orderParams(e: ethereum.Event, withUser: boolean): void {
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7)),
    ),
  );
  e.parameters.push(
    new ethereum.EventParam("integrator", ethereum.Value.fromAddress(INTEGRATOR)),
  );
  if (withUser) {
    e.parameters.push(
      new ethereum.EventParam("user", ethereum.Value.fromAddress(USER)),
    );
  }
  e.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100)),
    ),
  );
}

function placed(): B2BOrderPlaced {
  const e = changetype<B2BOrderPlaced>(newMockEvent());
  orderParams(e, true);
  return e;
}

function completed(): B2BOrderCompleted {
  const e = changetype<B2BOrderCompleted>(newMockEvent());
  orderParams(e, false);
  return e;
}

function cancelled(): B2BOrderCancelled {
  const e = changetype<B2BOrderCancelled>(newMockEvent());
  orderParams(e, false);
  return e;
}

describe("Integrator.activeOrderCount", () => {
  afterEach(() => {
    clearStore();
  });

  test("a cancel then dispute-completion of one order does not go negative", () => {
    // Mainnet: integrators at -2/-9/-1 had exactly 2/9/1 orders that were
    // both cancelled and completed; the contract's own counter is 0.
    handleB2BOrderPlaced(placed());
    handleB2BOrderCancelled(cancelled());
    handleB2BOrderCompleted(completed());

    assert.fieldEquals("Integrator", INTEGRATOR.toHexString(), "activeOrderCount", "0");
    assert.fieldEquals("Integrator", INTEGRATOR.toHexString(), "cancelledOrderCount", "1");
  });
});
