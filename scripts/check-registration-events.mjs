#!/usr/bin/env node
// Checks whether MerchantRegisteredToCircle (the event that sets CircleMerchant.circle)
// ever fired on-chain for the dangling merchants, and with what circleId.
//
// Scans the whole indexed range (startBlock..head) in one topic0-only pass,
// collecting every registration event, then reports per target merchant.

const RPC = process.env.RPC || "https://mainnet.base.org";
const ADDR = "0x4cad6eC90e65baBec9335cAd728DDC610c316368";
// keccak256("MerchantRegisteredToCircle(address,uint256,uint256,string,bytes32)")
const TOPIC0 =
  "0x45ddc48dd07fbcafaf29fe43b8e3aff70ae32ba7f81e1848aee147b293f9ca6c";
const START_BLOCK = 29875200;
const CHUNK = Number(process.env.CHUNK || 9999);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);

const TARGETS = [
  "0x0d96d50f91859fd87a57d54ad80b84b02415d884",
  "0x1d1b8604fc935e8c7a3cf3ff0219c7000ac78793",
  "0x7caa1440e2c5308a7a4ccaa22cc55017cd0f31d0",
  "0x854805b6fb4e5392ef9910e56f4672c12098c636",
  "0x95081c2f80c1b615385d4216b4a23cccfab020fc",
  "0x9e94c6e49a6d050993a0f6cfbdf59f7464a34784",
  "0xaf17db159efa7a3c929f7ae005e97e63c4cbd8a8",
  "0xbd82e35e1efceb714d663c13dea7ee4eeb293883",
  "0xd3ea2e2f7477a63821a6fd113151a0388179ea79",
  "0xdd21ace56af619c842ad99e566ffd24f7a198faa",
  "0xe5d5f357da00b92152104266a1e5d90b817cc9aa",
  "0xeb96b6e8ace641056250970bb100491f411c2686",
  "0xf4bda6c611978d5875595553cfae6f5a9f6f4477",
  "0xfda0a6a485431abb6f4b4dc8f5696b3758f7fe09",
].map((a) => a.toLowerCase());

let id = 1;
async function rpc(method, params) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
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

const hx = (n) => "0x" + n.toString(16);
const topicToAddr = (t) => "0x" + t.slice(26).toLowerCase();

async function main() {
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  console.log(`RPC ${RPC}`);
  console.log(`Scanning ${START_BLOCK}..${head} for MerchantRegisteredToCircle\n`);

  const ranges = [];
  for (let from = START_BLOCK; from <= head; from += CHUNK) {
    ranges.push([from, Math.min(from + CHUNK - 1, head)]);
  }

  const found = new Map(); // merchant -> { block, circleId }
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < ranges.length) {
      const [from, to] = ranges[cursor++];
      const logs = await rpc("eth_getLogs", [
        { address: ADDR, topics: [TOPIC0], fromBlock: hx(from), toBlock: hx(to) },
      ]);
      for (const lg of logs) {
        const merchant = topicToAddr(lg.topics[1]);
        const circleId = BigInt("0x" + lg.data.slice(2, 66)).toString();
        if (!found.has(merchant)) {
          found.set(merchant, {
            block: parseInt(lg.blockNumber, 16),
            circleId,
          });
        }
      }
      done++;
      if (done % 25 === 0 || done === ranges.length) {
        process.stdout.write(`\r  scanned ${done}/${ranges.length} chunks`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n\nTotal merchants ever registered on-chain: ${found.size}\n`);

  console.log("Target merchant registration status:");
  let none = 0;
  for (const m of TARGETS) {
    const r = found.get(m);
    if (r) {
      console.log(`  ${m}  REGISTERED  circleId=${r.circleId}  block=${r.block}`);
    } else {
      console.log(`  ${m}  NO MerchantRegisteredToCircle event found`);
      none++;
    }
  }
  console.log(
    `\n${TARGETS.length - none}/${TARGETS.length} have a registration event; ${none} have none.`,
  );
}

main().catch((e) => {
  console.error("\n" + (e.message || e));
  process.exit(1);
});
