import { BigInt, Bytes } from "@graphprotocol/graph-ts";

/**
 * Decodes a `bytes32` that carries a short ASCII string (currency codes such
 * as bytes32("INR"), ISO-3166 country codes such as bytes32("IN")) into its
 * printable form by dropping the zero padding. Non-printable bytes are
 * dropped too so a malformed value never yields an unreadable label.
 */
export function bytes32ToAscii(value: Bytes): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const b = value[i];
    if (b == 0) break;
    if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b);
  }
  return out;
}

/** Single-byte key fragment for a small integer (role ids, scopes, ...). */
export function bytesFromU8(value: i32): Bytes {
  const arr = new Uint8Array(1);
  arr[0] = value as u8;
  return Bytes.fromUint8Array(arr);
}

/** First four bytes of calldata (the function selector); empty if shorter. */
export function selectorOfCalldata(data: Bytes): Bytes {
  if (data.length < 4) return Bytes.empty();
  return Bytes.fromUint8Array(data.subarray(0, 4));
}

/** Immutable-log key: transaction hash ++ log index. */
export function logKey(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32());
}

/**
 * Expands a role bitmask (uint256) into the list of set bit positions. Roles
 * live in the low bits (MAX_ROLE = 9); we scan 32 to leave headroom for roles
 * added in later releases without a mapping change.
 */
export function maskToBits(mask: BigInt): i32[] {
  const bits: i32[] = [];
  const one = BigInt.fromI32(1);
  for (let i = 0; i < 32; i++) {
    if (
      !mask
        .rightShift(i as u8)
        .bitAnd(one)
        .isZero()
    )
      bits.push(i);
  }
  return bits;
}
