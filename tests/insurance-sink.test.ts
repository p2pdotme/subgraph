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
  MerchantPcFiatUpdated,
  InsuranceDebtAccrued,
  InsuranceDebtRepaid,
} from "../generated/InsuranceSinkFacet/InsuranceSinkFacet";
import {
  handleMerchantPcFiatUpdated,
  handleInsuranceDebtAccrued,
  handleInsuranceDebtRepaid,
} from "../src/insurance-sink";

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

function createInsuranceDebtAccruedEvent(
  merchant: Address,
  accountNo: BigInt,
  residualFiat: BigInt,
): InsuranceDebtAccrued {
  const mock = newMockEvent();
  const event = new InsuranceDebtAccrued(
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
    new ethereum.EventParam(
      "claimId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
    ),
  );
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
      "residualFiat",
      ethereum.Value.fromUnsignedBigInt(residualFiat),
    ),
  );
  return event;
}

function createInsuranceDebtRepaidEvent(
  merchant: Address,
  accountNo: BigInt,
  repaidFiat: BigInt,
  surplusToFreeFiat: BigInt,
): InsuranceDebtRepaid {
  const mock = newMockEvent();
  const event = new InsuranceDebtRepaid(
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
      "repaidFiat",
      ethereum.Value.fromUnsignedBigInt(repaidFiat),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "surplusToFreeFiat",
      ethereum.Value.fromUnsignedBigInt(surplusToFreeFiat),
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
    // realFiatBalance = fiatBalance - insuranceDebt
    assert.fieldEquals(
      "MerchantPaymentChannels",
      id,
      "realFiatBalance",
      "2000",
    );
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
    // realFiatBalance goes negative when the channel is in debt.
    assert.fieldEquals(
      "MerchantPaymentChannels",
      id,
      "realFiatBalance",
      "-4450",
    );
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
    assert.fieldEquals(
      "MerchantPaymentChannels",
      id,
      "realFiatBalance",
      "1920",
    );
  });

  // The key invariant: realFiatBalance stays correct when fiatBalance and
  // insuranceDebt are mutated by DIFFERENT events/handlers. Each handler routes
  // through savePaymentChannel(), which re-derives the field from current state.
  test("stays in sync when fiat and debt are changed by different handlers", () => {
    const merchant = Address.fromString(MERCHANT);
    const accountNo = BigInt.fromI32(ACCOUNT_NO);
    const id = pcId(MERCHANT, ACCOUNT_NO);

    // 1) Seed fiatBalance = 5000, debt = 0 → real = 5000.
    handleMerchantPcFiatUpdated(
      createMerchantPcFiatUpdatedEvent(
        merchant,
        accountNo,
        BigInt.fromI32(5000),
        BigInt.zero(),
      ),
    );
    assert.fieldEquals(
      "MerchantPaymentChannels",
      id,
      "realFiatBalance",
      "5000",
    );

    // 2) A separate event accrues debt = 2000 (fiatBalance untouched) → real = 3000.
    handleInsuranceDebtAccrued(
      createInsuranceDebtAccruedEvent(
        merchant,
        accountNo,
        BigInt.fromI32(2000),
      ),
    );
    assert.fieldEquals("MerchantPaymentChannels", id, "fiatBalance", "5000");
    assert.fieldEquals("MerchantPaymentChannels", id, "insuranceDebt", "2000");
    assert.fieldEquals(
      "MerchantPaymentChannels",
      id,
      "realFiatBalance",
      "3000",
    );

    // 3) A third event repays the debt (fiatBalance still untouched) → real = 5000.
    handleInsuranceDebtRepaid(
      createInsuranceDebtRepaidEvent(
        merchant,
        accountNo,
        BigInt.fromI32(2000),
        BigInt.zero(),
      ),
    );
    assert.fieldEquals("MerchantPaymentChannels", id, "fiatBalance", "5000");
    assert.fieldEquals("MerchantPaymentChannels", id, "insuranceDebt", "0");
    assert.fieldEquals(
      "MerchantPaymentChannels",
      id,
      "realFiatBalance",
      "5000",
    );
  });
});
