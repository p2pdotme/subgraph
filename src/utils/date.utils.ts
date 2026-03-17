import { BigInt } from "@graphprotocol/graph-ts";

export function getYearMonthFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  return month.toString() + "-" + year.toString(); // e.g. "9-2025"
}

export function getDayFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();
  return day.toString() + "-" + month.toString() + "-" + year.toString(); // e.g. "15-9-2025"
}
