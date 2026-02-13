import { BigInt } from "@graphprotocol/graph-ts";

/**
 * Get the day string from a timestamp (block timestamp in seconds)
 * @param timestamp - Unix timestamp in seconds
 * @returns The day string (e.g. "13")
 */
export function getDayStringFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  return date.getUTCDate().toString();
}

/**
 * Get the month string from a timestamp (block timestamp in seconds)
 * @param timestamp - Unix timestamp in seconds
 * @returns The month string (e.g. "2")
 */
export function getMonthStringFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  return (date.getUTCMonth() + 1).toString();
}

/**
 * Get the year string from a timestamp (block timestamp in seconds)
 * @param timestamp - Unix timestamp in seconds
 * @returns The year string (e.g. "2026")
 */
export function getYearStringFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  return date.getUTCFullYear().toString();
}

/**
 * Get the year and month from a timestamp
 * @param timestamp - The timestamp to get the year and month from
 * @returns The year and month in the format "M-YYYY" (e.g. "9-2025")
 */
export function getYearMonthFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  return month.toString() + "-" + year.toString(); // e.g. "9-2025"
}

/**
 * Get the day, month and year from a timestamp
 * @param timestamp - The timestamp to get the day, month and year from
 * @returns The day, month and year in the format "D-M-YYYY" (e.g. "13-2-2026")
 */
export function getDayMonthYearFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  let day = date.getUTCDate();
  let month = date.getUTCMonth() + 1;
  let year = date.getUTCFullYear();
  return day.toString() + "-" + month.toString() + "-" + year.toString(); // e.g. "13-2-2026"
}
