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
  PIPContributed,
  SeizedMerchantStakeToCaip,
  SeizedStakeRecorded,
  SeizedStakeReleased,
} from "../generated/InsurancePoolFacet/InsurancePoolFacet";
import {
  P2PStakeSeized,
  P2PStakeSeizedForCountry,
} from "../generated/P2PStakeBoostFacet/P2PStakeBoostFacet";
import {
  handlePIPContributed,
  handleSeizedMerchantStakeToCaip,
  handleSeizedStakeRecorded,
  handleSeizedStakeReleased,
} from "../src/insurance-pool";
import {
  handleP2PStakeSeized,
  handleP2PStakeSeizedForCountry,
} from "../src/p2p-stake";

const ALICE = Address.fromString("0x000000000000000000000000000000000000000a");
const RESERVE = Address.fromString(
  "0x000000000000000000000000000000000000000c",
);
const USDC = Address.fromString("0x000000000000000000000000000000000000000d");
const INSURANCE = Address.fromString(
  "0x17192bd2e8893e4ea0ab5db67adbf38ae42e9931",
);
const COUNTRY_IN = Bytes.fromHexString(
  "0x494e000000000000000000000000000000000000000000000000000000000000",
);

let nextLogIndex = 0;

// Module scope: AssemblyScript has no closures, so a builder defined inside a
// describe miscompiles into a wasm-validator failure rather than a type error.
function baseEvent<T extends ethereum.Event>(): T {
  const mock = newMockEvent();
  const e = changetype<T>(mock);
  e.address = INSURANCE;
  e.logIndex = BigInt.fromI32(nextLogIndex++);
  e.parameters = new Array<ethereum.EventParam>();
  return e;
}

function param(name: string, value: ethereum.Value): ethereum.EventParam {
  return new ethereum.EventParam(name, value);
}

function recordedEvent(amount: i32): SeizedStakeRecorded {
  const e = baseEvent<SeizedStakeRecorded>();
  e.parameters.push(param("token", ethereum.Value.fromAddress(USDC)));
  e.parameters.push(
    param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
  );
  e.parameters.push(
    param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  return e;
}

function releasedEvent(amount: i32, to: Address): SeizedStakeReleased {
  const e = baseEvent<SeizedStakeReleased>();
  e.parameters.push(param("token", ethereum.Value.fromAddress(USDC)));
  e.parameters.push(
    param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
  );
  e.parameters.push(param("to", ethereum.Value.fromAddress(to)));
  e.parameters.push(
    param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  return e;
}

function toCaipEvent(circleId: i32, amount: i32): SeizedMerchantStakeToCaip {
  const e = baseEvent<SeizedMerchantStakeToCaip>();
  e.parameters.push(
    param(
      "circleId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(circleId)),
    ),
  );
  e.parameters.push(
    param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
  );
  e.parameters.push(
    param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  return e;
}

function contributedEvent(amount: i32): PIPContributed {
  const e = baseEvent<PIPContributed>();
  e.parameters.push(param("from", ethereum.Value.fromAddress(ALICE)));
  e.parameters.push(
    param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  return e;
}

function stakeSeizedEvent(amount: i32): P2PStakeSeized {
  const e = baseEvent<P2PStakeSeized>();
  e.parameters.push(param("user", ethereum.Value.fromAddress(ALICE)));
  e.parameters.push(
    param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  e.parameters.push(param("fraudReserve", ethereum.Value.fromAddress(RESERVE)));
  return e;
}

function stakeSeizedForCountryEvent(amount: i32): P2PStakeSeizedForCountry {
  const e = baseEvent<P2PStakeSeizedForCountry>();
  e.parameters.push(param("user", ethereum.Value.fromAddress(ALICE)));
  e.parameters.push(
    param("country", ethereum.Value.fromFixedBytes(COUNTRY_IN)),
  );
  e.parameters.push(
    param("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  return e;
}

const LEDGER_ID = USDC.concat(COUNTRY_IN).toHexString();
const ALICE_ID = ALICE.toHexString();

describe("InsurancePoolFacet — R8.2 seized stake", () => {
  afterEach(() => {
    clearStore();
  });

  test("records and releases net out on the country ledger", () => {
    handleSeizedStakeRecorded(recordedEvent(100));
    handleSeizedStakeRecorded(recordedEvent(50));
    handleSeizedStakeReleased(releasedEvent(30, ALICE));

    assert.fieldEquals("SeizedStake", LEDGER_ID, "recordedTotal", "150");
    assert.fieldEquals("SeizedStake", LEDGER_ID, "releasedTotal", "30");
    assert.fieldEquals("SeizedStake", LEDGER_ID, "amount", "120");
    assert.fieldEquals("SeizedStake", LEDGER_ID, "countryCode", "IN");
    assert.entityCount("SeizedStakeActivity", 3);
  });

  test("a release with no indexed record goes negative rather than clamping", () => {
    // A subgraph deployed after the seizure sees only the release. Clamping to
    // zero would make a wrong balance look plausible; the entity comment points
    // at getSeizedStake for the authoritative figure.
    handleSeizedStakeReleased(releasedEvent(40, ALICE));
    assert.fieldEquals("SeizedStake", LEDGER_ID, "amount", "-40");
    assert.fieldEquals("SeizedStake", LEDGER_ID, "recordedTotal", "0");
  });

  test("a CAIP credit is logged but does not move the token ledger", () => {
    handleSeizedStakeRecorded(recordedEvent(100));
    handleSeizedMerchantStakeToCaip(toCaipEvent(4, 70));

    // Keyed by circle, so it is not a token+country credit.
    assert.fieldEquals("SeizedStake", LEDGER_ID, "amount", "100");
    assert.entityCount("SeizedStakeActivity", 2);
  });

  test("PIP contributions are logged per call, with no authority implied", () => {
    handlePIPContributed(contributedEvent(10));
    handlePIPContributed(contributedEvent(20));
    assert.entityCount("PIPContribution", 2);
  });
});

describe("P2PStakeBoostFacet — the country half of a seizure", () => {
  afterEach(() => {
    clearStore();
  });

  test("the country annotation never double-counts the seizure", () => {
    // Both events fire in the SAME transaction for the same act: P2PStakeSeized
    // names the reserve, P2PStakeSeizedForCountry names the country pool that
    // was actually credited. If the second one touched totalSeized, every user
    // stake seizure would read as twice the amount taken.
    handleP2PStakeSeized(stakeSeizedEvent(500));
    handleP2PStakeSeizedForCountry(stakeSeizedForCountryEvent(500));

    assert.fieldEquals("UserP2PStake", ALICE_ID, "totalSeized", "500");
    assert.fieldEquals("UserP2PStake", ALICE_ID, "status", "SEIZED");
    assert.fieldEquals("UserP2PStake", ALICE_ID, "stakedAmount", "0");
    assert.fieldEquals(
      "UserP2PStake",
      ALICE_ID,
      "seizedForCountry",
      COUNTRY_IN.toHexString(),
    );
    assert.fieldEquals("UserP2PStake", ALICE_ID, "seizedForCountryCode", "IN");
  });
});
