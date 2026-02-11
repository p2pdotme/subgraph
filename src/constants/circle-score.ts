// Minimum orders required before computing circle score
export const MIN_ORDERS_FOR_SCORE: i32 = 10;

// Order types (from OrderProcessorStorage.sol)
export const ORDER_TYPE_BUY: i32 = 0;
export const ORDER_TYPE_SELL: i32 = 1;
export const ORDER_TYPE_PAY: i32 = 2;

// Score formula weights (as percentages)
export const WEIGHT_SPEED: i32 = 35; // 35%
export const WEIGHT_DISPUTE: i32 = 30; // 30%
export const WEIGHT_MERCHANTS: i32 = 20; // 20%
export const WEIGHT_VOLUME: i32 = 15; // 15%

// Speed calculation bounds (in seconds)
export const MIN_SETTLEMENT_SECONDS: i32 = 45; // Best case
export const MAX_SETTLEMENT_SECONDS: i32 = 150; // Worst case

// Dispute rate scaling factor
export const DISPUTE_RATE_MULTIPLIER: i32 = 1800;

// Volume threshold (in USDC, 6 decimals) — 1M USDC
export const VOLUME_THRESHOLD_USDC: i64 = 1_000_000_000_000;

// Merchants threshold
export const MERCHANTS_THRESHOLD: i32 = 100;

// Fixed-point scale factors
export const DISPUTE_RATE_SCALE: i32 = 10000; // Rate * 10000

// Bootstrap lifecycle thresholds
export const BOOTSTRAP_ORDERS: i32 = 40;
export const BOOTSTRAP_USDC_VOLUME: i64 = 20_000_000_000; // 20K USDC in raw 6-dec
export const BOOTSTRAP_MAX_WEIGHT: i32 = 25;

// Trust Firewall thresholds
export const MAX_DISPUTE_RATE: i32 = 1200; // 0.12 × 10000
export const BOOTSTRAP_MAX_DISPUTE_RATE: i32 = 2000; // 0.20 × 10000
export const MAX_SETTLEMENT_FOR_PAUSE: i32 = 600; // seconds

// Circle status values
export const STATUS_BOOTSTRAP: string = "bootstrap";
export const STATUS_ACTIVE: string = "active";
export const STATUS_REJECTED: string = "rejected";
export const STATUS_PAUSED: string = "paused";

// Rolling window
export const SECONDS_PER_DAY: i32 = 86400;
export const ROLLING_WINDOW_DAYS: i32 = 30;
