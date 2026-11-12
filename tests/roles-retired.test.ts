import { assert, describe, test } from "matchstick-as/assembly/index";
import {
  ROLE_ADMIN_VALUE_RETIRED,
  ROLE_CAPABILITY_GRANTEE,
  ROLE_CIRCLE_ADMIN,
  ROLE_COMMUNITY_ADMIN,
  ROLE_INSURANCE_ADMIN,
  ROLE_OPS_LEAD,
  isRetiredRole,
} from "../src/constants/roles";

// contracts-v4 #464 (ff3f9e5) RoleStorage.RETIRED_ROLES_MASK = 5 | 8 | 9 | 10.
// Bit 5 (CIRCLE_ADMIN) was retired at R8 (d6d1ef2): grantRole refuses it and
// LibAuth answers it from circles[id].admin, so a bit-5 RoleMember row holds
// nothing.
describe("retired role bits", () => {
  test("match RETIRED_ROLES_MASK, CIRCLE_ADMIN included", () => {
    assert.booleanEquals(true, isRetiredRole(ROLE_CIRCLE_ADMIN));
    assert.booleanEquals(true, isRetiredRole(ROLE_CAPABILITY_GRANTEE));
    assert.booleanEquals(true, isRetiredRole(ROLE_ADMIN_VALUE_RETIRED));
    assert.booleanEquals(true, isRetiredRole(ROLE_INSURANCE_ADMIN));
    assert.booleanEquals(false, isRetiredRole(ROLE_COMMUNITY_ADMIN));
    assert.booleanEquals(false, isRetiredRole(ROLE_OPS_LEAD));
  });
});
