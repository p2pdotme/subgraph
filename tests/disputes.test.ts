import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CircleDisputeRejectionSuppressed,
  DisputeAppealWindowSet,
  DisputeDecisionSlaSet,
} from "../generated/OrderProcessorFacet/OrderProcessorFacet";
import {
  CurrencyCashbackPercentageUpdated,
  CurrencyProcessingTimeUpdated,
  MinSellTxLimitUpdated,
} from "../generated/SetterFacet/SetterFacet";
import {
  handleCircleDisputeRejectionSuppressed,
  handleDisputeAppealWindowSet,
  handleDisputeDecisionSlaSet,
} from "../src/order";
import {
  handleCurrencyCashbackPercentageUpdated,
  handleCurrencyProcessingTimeUpdated,
  handleMinSellTxLimitUpdated,
} from "../src/setter-facet";

const ALICE = Address.fromString("0x000000000000000000000000000000000000000a");
const BOB = Address.fromString("0x000000000000000000000000000000000000000b");
const DIAMOND = Address.fromString(
  "0x4cad6ec90e65babec9335cad728ddc610c316368",
);
const CURRENCY_INR = Bytes.fromHexString(
  "0x494e520000000000000000000000000000000000000000000000000000000000",
);

let nextLogIndex = 0;

// Module scope, never inside a describe: AssemblyScript has no closures, and a
// builder captured from an enclosing function miscompiles into a wasm-validator
// "local.get index must be small enough" failure rather than a type error.
function baseEvent<T extends ethereum.Event>(): T {
  const mock = newMockEvent();
  const e = changetype<T>(mock);
  e.address = DIAMOND;
  e.logIndex = BigInt.fromI32(nextLogIndex++);
  e.parameters = new Array<ethereum.EventParam>();
  return e;
}

function param(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

function appealWindowEvent(window: i32): DisputeAppealWindowSet {
  const e = baseEvent<DisputeAppealWindowSet>();
  e.parameters.push(
    param("currency", ethereum.Value.fromFixedBytes(CURRENCY_INR)),
  );
  e.parameters.push(
    param("window", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(window))),
  );
  return e;
}

function slaEvent(tier1: i32, tier2: i32): DisputeDecisionSlaSet {
  const e = baseEvent<DisputeDecisionSlaSet>();
  e.parameters.push(
    param("currency", ethereum.Value.fromFixedBytes(CURRENCY_INR)),
  );
  e.parameters.push(
    param("tier1", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tier1))),
  );
  e.parameters.push(
    param("tier2", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tier2))),
  );
  return e;
}

function suppressedEvent(
  by: Address,
  circleId: i32,
  counter: i32,
): CircleDisputeRejectionSuppressed {
  const e = baseEvent<CircleDisputeRejectionSuppressed>();
  e.parameters.push(param("by", ethereum.Value.fromAddress(by)));
  e.parameters.push(
    param(
      "circleId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(circleId)),
    ),
  );
  e.parameters.push(
    param(
      "disputeCounter",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(counter)),
    ),
  );
  return e;
}

function cashbackEvent(bps: i32): CurrencyCashbackPercentageUpdated {
  const e = baseEvent<CurrencyCashbackPercentageUpdated>();
  e.parameters.push(
    param("currency", ethereum.Value.fromFixedBytes(CURRENCY_INR)),
  );
  e.parameters.push(param("bps", ethereum.Value.fromI32(bps)));
  return e;
}

function processingTimeEvent(
  buyMin: i32,
  buyMax: i32,
  sellMin: i32,
  sellMax: i32,
): CurrencyProcessingTimeUpdated {
  const e = baseEvent<CurrencyProcessingTimeUpdated>();
  e.parameters.push(
    param("currency", ethereum.Value.fromFixedBytes(CURRENCY_INR)),
  );
  const tuple = changetype<ethereum.Tuple>([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(buyMin)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(buyMax)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(sellMin)),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(sellMax)),
  ]);
  e.parameters.push(param("processingTime", ethereum.Value.fromTuple(tuple)));
  return e;
}

function minSellEvent(previous: i32, floor: i32): MinSellTxLimitUpdated {
  const e = baseEvent<MinSellTxLimitUpdated>();
  e.parameters.push(
    param("currency", ethereum.Value.fromFixedBytes(CURRENCY_INR)),
  );
  e.parameters.push(
    param(
      "previous",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(previous)),
    ),
  );
  e.parameters.push(
    param("floor", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(floor))),
  );
  return e;
}

const CURRENCY_HEX = CURRENCY_INR.toHexString();

describe("OrderProcessorFacet — R8.2 dispute settings", () => {
  afterEach(() => {
    clearStore();
  });

  test("the per-currency dispute settings land on Currency", () => {
    handleDisputeAppealWindowSet(appealWindowEvent(3600));
    handleDisputeDecisionSlaSet(slaEvent(7200, 10800));

    assert.fieldEquals(
      "Currency",
      CURRENCY_HEX,
      "disputeAppealWindowSeconds",
      "3600",
    );
    assert.fieldEquals(
      "Currency",
      CURRENCY_HEX,
      "disputeDecisionSlaTier1",
      "7200",
    );
    assert.fieldEquals(
      "Currency",
      CURRENCY_HEX,
      "disputeDecisionSlaTier2",
      "10800",
    );

    // 0 is "follow the network default", not "no window" — it must be stored as
    // the value it is and left for the consumer to read as the default.
    handleDisputeAppealWindowSet(appealWindowEvent(0));
    assert.fieldEquals(
      "Currency",
      CURRENCY_HEX,
      "disputeAppealWindowSeconds",
      "0",
    );
  });

  test("a suppression is logged as its own immutable row", () => {
    handleCircleDisputeRejectionSuppressed(suppressedEvent(ALICE, 3, 11));
    handleCircleDisputeRejectionSuppressed(suppressedEvent(ALICE, 3, 12));
    // Two suppressions of the same circle are two facts, not an overwrite.
    assert.entityCount("CircleDisputeRejectionSuppression", 2);
  });
});

describe("SetterFacet — R8.2 per-currency overrides", () => {
  afterEach(() => {
    clearStore();
  });

  test("cashback, processing time and the min sell floor all land", () => {
    handleCurrencyCashbackPercentageUpdated(cashbackEvent(250));
    handleCurrencyProcessingTimeUpdated(processingTimeEvent(60, 600, 90, 900));
    handleMinSellTxLimitUpdated(minSellEvent(0, 5000000));

    assert.fieldEquals("Currency", CURRENCY_HEX, "cashbackBps", "250");
    assert.fieldEquals("Currency", CURRENCY_HEX, "processingTimeBuyMin", "60");
    assert.fieldEquals("Currency", CURRENCY_HEX, "processingTimeBuyMax", "600");
    assert.fieldEquals("Currency", CURRENCY_HEX, "processingTimeSellMin", "90");
    assert.fieldEquals(
      "Currency",
      CURRENCY_HEX,
      "processingTimeSellMax",
      "900",
    );
    assert.fieldEquals("Currency", CURRENCY_HEX, "minSellTxLimit", "5000000");
  });

  test("cashback 0 is a real setting, and the row keeps the new floor", () => {
    handleCurrencyCashbackPercentageUpdated(cashbackEvent(250));
    // 0 switches cashback off in this market. There is no un-set, so the value
    // alone cannot distinguish that from "never configured" — which is exactly
    // why the field is stored rather than inferred.
    handleCurrencyCashbackPercentageUpdated(cashbackEvent(0));
    assert.fieldEquals("Currency", CURRENCY_HEX, "cashbackBps", "0");

    // `previous` is deliberately not stored: the row is current state.
    handleMinSellTxLimitUpdated(minSellEvent(5000000, 7000000));
    assert.fieldEquals("Currency", CURRENCY_HEX, "minSellTxLimit", "7000000");
  });
});
