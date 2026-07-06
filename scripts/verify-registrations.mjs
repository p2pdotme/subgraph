#!/usr/bin/env node
// Post-sync completeness gate: verifies a deployed subgraph version indexed
// every MerchantRegisteredToCircle event that exists on-chain.
//
// Why: the hosted indexing pipeline has intermittently dropped log ranges
// during backfill (versions 0.2.5-0.2.8 each missed a different random set of
// events while reporting "Synced 100% / healthy"). A merchant whose one-shot
// registration event is dropped ends up as a circleId=0 stub with a null
// circle link. Run this before moving the `prod` tag to a new version.
//
//   1. Scans the chain (topic0-only eth_getLogs, chunked) for every
//      MerchantRegisteredToCircle event from the diamond.
//   2. Pages every CircleMerchant from the subgraph.
//   3. Diffs: missing rows, circleId=0 stubs, circleId mismatches.
//
// Usage:
//   node scripts/verify-registrations.mjs [subgraph-endpoint]
//   SUBGRAPH_URL=https://.../0.2.9/gn RPC=https://mainnet.base.org \
//     node scripts/verify-registrations.mjs
//
// Env: RPC, SUBGRAPH_URL, START_BLOCK, END_BLOCK (defaults: subgraph head),
//      CHUNK (getLogs range, default 9999), CONCURRENCY (default 6)
//
// Exit code: 0 = complete, 1 = gaps found, 2 = execution error.

const RPC = process.env.RPC || "https://mainnet.base.org";
const ENDPOINT =
  process.argv[2] ||
  process.env.SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmq7kbyqt81p501xi7h0wdeuh/subgraphs/p2pme-subgraph/0.2.9/gn";

const DIAMOND = "0x4cad6eC90e65baBec9335cAd728DDC610c316368";
// keccak256("MerchantRegisteredToCircle(address,uint256,uint256,string,bytes32)")
const TOPIC0 =
  "0x45ddc48dd07fbcafaf29fe43b8e3aff70ae32ba7f81e1848aee147b293f9ca6c";
// MerchantOnboardFacet startBlock in subgraph.yaml
const START_BLOCK = Number(process.env.START_BLOCK || 29875200);
const CHUNK = Number(process.env.CHUNK || 9999);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);

let rpcId = 1;
async function rpc(method, params) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
      });
      if (res.status === 429) throw new Error("429 rate limited");
      const json = await res.json();
      if (json.error) throw new Error(JSON.stringify(json.error));
      return json.result;
    } catch (e) {
      if (attempt === 7) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error("GraphQL error: " + JSON.stringify(json.errors));
  }
  return json.data;
}

const hx = (n) => "0x" + n.toString(16);
const topicToAddr = (t) => "0x" + t.slice(26).toLowerCase();

async function scanChain(from, to) {
  const ranges = [];
  for (let b = from; b <= to; b += CHUNK) {
    ranges.push([b, Math.min(b + CHUNK - 1, to)]);
  }
  const events = new Map(); // merchant -> {circleId, block, tx}
  let done = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < ranges.length) {
      const [a, z] = ranges[cursor++];
      const logs = await rpc("eth_getLogs", [
        { address: DIAMOND, topics: [TOPIC0], fromBlock: hx(a), toBlock: hx(z) },
      ]);
      for (const log of logs) {
        const merchant = topicToAddr(log.topics[1]);
        const circleId = BigInt("0x" + log.data.slice(2, 66));
        // last registration wins (matches handler semantics)
        const prev = events.get(merchant);
        const block = parseInt(log.blockNumber, 16);
        if (!prev || block >= prev.block) {
          events.set(merchant, { circleId, block, tx: log.transactionHash });
        }
      }
      done++;
      if (done % 100 === 0) {
        process.stderr.write(`  scanned ${done}/${ranges.length} ranges\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stderr.write("\n");
  return events;
}

async function fetchSubgraphMerchants() {
  const out = new Map(); // id -> circleId
  let cursor = "";
  for (;;) {
    const data = await gql(
      `query($cursor: Bytes!) {
        circleMerchants(first: 1000, orderBy: id, where: { id_gt: $cursor }) {
          id
          circleId
        }
      }`,
      { cursor },
    );
    const rows = data.circleMerchants;
    for (const r of rows) out.set(r.id.toLowerCase(), BigInt(r.circleId));
    if (rows.length < 1000) break;
    cursor = rows[rows.length - 1].id;
  }
  return out;
}

async function main() {
  const meta = await gql(
    `{ _meta { block { number } hasIndexingErrors } }`,
    {},
  );
  const head = meta._meta.block.number;
  const endBlock = Number(process.env.END_BLOCK || head);

  console.log(`Subgraph: ${ENDPOINT}`);
  console.log(
    `Subgraph head: ${head} (hasIndexingErrors: ${meta._meta.hasIndexingErrors})`,
  );
  console.log(`RPC: ${RPC}`);
  console.log(`Scanning chain ${START_BLOCK}..${endBlock} for registrations`);

  const [onChain, indexed] = await Promise.all([
    scanChain(START_BLOCK, endBlock),
    fetchSubgraphMerchants(),
  ]);

  console.log(`On-chain registrations: ${onChain.size} unique merchants`);
  console.log(`Indexed CircleMerchants: ${indexed.size}`);

  const missing = [];
  const stubs = [];
  const mismatched = [];
  for (const [merchant, ev] of onChain) {
    const got = indexed.get(merchant);
    if (got === undefined) {
      missing.push({ merchant, ...ev });
    } else if (got === 0n) {
      stubs.push({ merchant, ...ev });
    } else if (got !== ev.circleId) {
      mismatched.push({ merchant, expected: ev.circleId, got, ...ev });
    }
  }

  const report = (title, rows, fmt) => {
    console.log(`\n${title}: ${rows.length}`);
    for (const r of rows) console.log("  " + fmt(r));
  };
  report(
    "MISSING (registered on-chain, no CircleMerchant row)",
    missing,
    (r) => `${r.merchant} circleId=${r.circleId} block=${r.block} tx=${r.tx}`,
  );
  report(
    "STUBS (row exists but circleId=0 — registration event dropped)",
    stubs,
    (r) => `${r.merchant} expected circleId=${r.circleId} block=${r.block} tx=${r.tx}`,
  );
  report(
    "MISMATCHED circleId",
    mismatched,
    (r) => `${r.merchant} on-chain=${r.expected} indexed=${r.got} block=${r.block}`,
  );

  const bad = missing.length + stubs.length + mismatched.length;
  console.log(
    bad === 0
      ? "\nOK: subgraph registrations are complete for the scanned range."
      : `\nFAIL: ${bad} merchant(s) with dropped or divergent registration data.`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
