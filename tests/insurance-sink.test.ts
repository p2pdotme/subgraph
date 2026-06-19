import {
  assert,
  describe,
  test,
  clearStore,
  afterEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { MerchantPcFiatUpdated } from "../generated/InsuranceSinkFacet/InsuranceSinkFacet";
import { handleMerchantPcFiatUpdated } from "../src/insurance-sink";

const MERCHANT = "0x0000000000000000000000000000000000000001";
const ACCOUNT_NO = 1234;

function createMerchantPcFiatUpdatedEvent(
  merchant: Address,
  accountNo: BigInt,
  freeFiat: BigInt,
  insuranceDebt: BigInt,
): MerchantPcFiatUpdated {
  const mock = newMockEvent();
  const event = new MerchantPcFiatUpdated(
    mock.address,
    mock.logIndex,
    mock.transactionLogIndex,
    mock.logType,
    mock.block,
    mock.transaction,
    mock.parameters,
    mock.receipt,
  );
  event.parameters = new Array<ethereum.EventParam>();
  event.parameters.push(
    new ethereum.EventParam("merchant", ethereum.Value.fromAddress(merchant)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "accountNo",
      ethereum.Value.fromUnsignedBigInt(accountNo),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "freeFiat",
      ethereum.Value.fromUnsignedBigInt(freeFiat),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "insuranceDebt",
      ethereum.Value.fromUnsignedBigInt(insuranceDebt),
    ),
  );
  return event;
}

function pcId(merchant: string, accountNo: i32): string {
  return Bytes.fromUTF8(`${merchant}-${accountNo.toString()}`).toHexString();
}

describe("handleMerchantPcFiatUpdated", () => {
  afterEach(() => {
    clearStore();
  });

  // Consume-only write-off: freeFiat reduced, debt stays 0.
  test("sets fiatBalance and leaves debt zero on a consume-only write-off", () => {
    handleMerchantPcFiatUpdated(
      createMerchantPcFiatUpdatedEvent(
        Address.fromString(MERCHANT),
        BigInt.fromI32(ACCOUNT_NO),
        BigInt.fromI32(2000),
        BigInt.zero(),
      ),
    );
    const id = pcId(MERCHANT, ACCOUNT_NO);
    assert.fieldEquals("MerchantPaymentChannels", id, "fiatBalance", "2000");
    assert.fieldEquals("MerchantPaymentChannels", id, "insuranceDebt", "0");
  });

  // Deficit write-off: freeFiat floored to 0, residual recorded as debt.
  test("zeroes fiatBalance and records debt on a deficit write-off", () => {
    handleMerchantPcFiatUpdated(
      createMerchantPcFiatUpdatedEvent(
        Address.fromString(MERCHANT),
        BigInt.fromI32(ACCOUNT_NO),
        BigInt.zero(),
        BigInt.fromI32(4450),
      ),
    );
    const id = pcId(MERCHANT, ACCOUNT_NO);
    assert.fieldEquals("MerchantPaymentChannels", id, "fiatBalance", "0");
    assert.fieldEquals("MerchantPaymentChannels", id, "insuranceDebt", "4450");
  });

  // The snapshot is authoritative: a later event overwrites both fields.
  test("overwrites both fields with the latest authoritative snapshot", () => {
    handleMerchantPcFiatUpdated(
      createMerchantPcFiatUpdatedEvent(
        Address.fromString(MERCHANT),
        BigInt.fromI32(ACCOUNT_NO),
        BigInt.zero(),
        BigInt.fromI32(4450),
      ),
    );
    handleMerchantPcFiatUpdated(
      createMerchantPcFiatUpdatedEvent(
        Address.fromString(MERCHANT),
        BigInt.fromI32(ACCOUNT_NO),
        BigInt.fromI32(1920),
        BigInt.zero(),
      ),
    );
    const id = pcId(MERCHANT, ACCOUNT_NO);
    assert.fieldEquals("MerchantPaymentChannels", id, "fiatBalance", "1920");
    assert.fieldEquals("MerchantPaymentChannels", id, "insuranceDebt", "0");
  });
});
