export const STATUS_PENDING: i32 = 0;
export const STATUS_COMPLETED: i32 = 1;
export const STATUS_FAILED: i32 = 2;

export const DISPUTE_STATUS_RAISED: i32 = 1;
export const DISPUTE_STATUS_SETTLED: i32 = 2;

// Order Status enum values
export const ORDER_STATUS_PLACED: i32 = 0;
export const ORDER_STATUS_ACCEPTED: i32 = 1;
export const ORDER_STATUS_PAID: i32 = 2;
export const ORDER_STATUS_COMPLETED: i32 = 3;
export const ORDER_STATUS_CANCELLED: i32 = 4;

export const UNSTAKE_REQUEST_RAISED: i32 = 0;
export const UNSTAKE_REQUEST_WITHDRAWN: i32 = 1;

// Migration Status: 0=DEFAULT, 1=PENDING, 2=APPROVED, 3=REJECTED
export const MIGRATION_STATUS_DEFAULT: i32 = 0;
export const MIGRATION_STATUS_PENDING: i32 = 1;
export const MIGRATION_STATUS_APPROVED: i32 = 2;
export const MIGRATION_STATUS_REJECTED: i32 = 3;

// Order Type enum values
export const ORDER_TYPE_BUY: i32 = 0;
export const ORDER_TYPE_SELL: i32 = 1;
export const ORDER_TYPE_PAY: i32 = 2;