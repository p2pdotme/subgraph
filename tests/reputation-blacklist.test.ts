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
  ReputationPointsUpdated,
  UserBlacklisted,
} from "../generated/ReputationManager/ReputationManager";
import {
  handleReputationPointsUpdated,
  handleUserBlacklisted,
} from "../src/reputation-manager";

const USER = Address.fromString("0x0008f823b5106e7ab364d6f2e6f2560d5eb50165");

function rpUpdated(points: i32): ReputationPointsUpdated {
  const e = changetype<ReputationPointsUpdated>(newMockEvent());
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(USER)),
  );
  e.parameters.push(
    new ethereum.EventParam(
      "rpChange",
      ethereum.Value.fromSignedBigInt(BigInt.fromI32(points)),
    ),
  );
  const rmUser = new ethereum.Tuple();
  rmUser.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(points)));
  rmUser.push(ethereum.Value.fromUnsignedBigInt(BigInt.zero()));
  rmUser.push(ethereum.Value.fromBoolean(false));
  e.parameters.push(
    new ethereum.EventParam("_user", ethereum.Value.fromTuple(rmUser)),
  );
  return e;
}

function blacklisted(): UserBlacklisted {
  const e = changetype<UserBlacklisted>(newMockEvent());
  e.parameters = new Array<ethereum.EventParam>();
  e.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(USER)),
  );
  return e;
}

describe("UserBlacklisted", () => {
  afterEach(() => {
    clearStore();
  });

  test("blacklisting zeroes reputation points like the contract does", () => {
    // Mainnet: 0x0008f823… shows 50 RP in the subgraph, 0 on-chain.
    handleReputationPointsUpdated(rpUpdated(50));
    handleUserBlacklisted(blacklisted());

    assert.fieldEquals("User", USER.toHexString(), "isBlacklisted", "true");
    assert.fieldEquals("User", USER.toHexString(), "reputationPoint", "0");
  });

  test("points earned after blacklisting are still tracked", () => {
    handleReputationPointsUpdated(rpUpdated(50));
    handleUserBlacklisted(blacklisted());
    handleReputationPointsUpdated(rpUpdated(5));

    assert.fieldEquals("User", USER.toHexString(), "reputationPoint", "5");
  });
});
