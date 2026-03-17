import { BigInt } from "@graphprotocol/graph-ts";

function padTwo(n: i32): string {
  return n < 10 ? "0" + n.toString() : n.toString();
}

export function getYearMonthFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  return year.toString() + "-" + padTwo(month); // e.g. "2025-09"
}

export function getDayFromTimestamp(timestamp: BigInt): string {
  let ms = timestamp.toI64() * 1000;
  let date = new Date(ms);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();
  return year.toString() + "-" + padTwo(month) + "-" + padTwo(day); // e.g. "2025-09-15"
}
