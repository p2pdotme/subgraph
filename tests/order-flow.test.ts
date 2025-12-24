import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { AdditionalOrderDetails } from "../generated/schema"
import { AdditionalOrderDetails as AdditionalOrderDetailsEvent } from "../generated/OrderFlow/OrderFlow"
import { handleAdditionalOrderDetails } from "../src/order-flow"
import { createAdditionalOrderDetailsEvent } from "./order-flow-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let orderId = BigInt.fromI32(234)
    let details = "ethereum.Tuple Not implemented"
    let newAdditionalOrderDetailsEvent = createAdditionalOrderDetailsEvent(
      orderId,
      details
    )
    handleAdditionalOrderDetails(newAdditionalOrderDetailsEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("AdditionalOrderDetails created and stored", () => {
    assert.entityCount("AdditionalOrderDetails", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "AdditionalOrderDetails",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "orderId",
      "234"
    )
    assert.fieldEquals(
      "AdditionalOrderDetails",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "details",
      "ethereum.Tuple Not implemented"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
