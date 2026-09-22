#!/usr/bin/env node
/**
 * Generates `src/constants/selectors.ts`: a bytes4 selector -> "Contract.fn(types)"
 * lookup used by the role-registry mappings to label SelectorPolicy, CoSign,
 * LegacyAuthUsage and TimelockCall entities with a readable function name.
 *
 * Usage:
 *   node scripts/generate-selectors.mjs <artifacts-dir> [more dirs...]
 *
 * <artifacts-dir> is either a hardhat `artifacts/` tree (contracts-v4 after
 * `npm run compile`) or any flat directory of `*.json` ABI artifacts. With no
 * argument it falls back to this repo's `abis/` folder (which only covers the
 * facets the subgraph indexes — the full permission map needs every facet, so
 * regenerate from the contracts repo after each release).
 *
 * Third-party sources (anything outside `contracts/`), test contracts
 * (`contracts/test/**`) and interfaces (`**\/interfaces/**`) are skipped; when several contracts share a selector the alphabetically first
 * non-Legacy contract name wins (the signature is identical either way).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { keccak_256 } from "@noble/hashes/sha3.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [path.join(root, "abis")];
const outFile = path.join(root, "src", "constants", "selectors.ts");
const metaFile = path.join(root, "src", "constants", "selectors.meta.json");

/**
 * Resolves the git commit of the repository a source directory belongs to, so
 * the generated map records WHICH contracts it was built from. The console
 * repo generates its own selector inventory from the same contracts; two
 * generated inventories drift silently unless both are pinned to a ref and
 * compared, so `selectors.meta.json` exists to make that comparison a CI
 * check rather than an archaeology exercise.
 */
function gitRefOf(dir) {
  try {
    const commit = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    let describe = "";
    try {
      describe = execFileSync(
        "git",
        ["-C", dir, "describe", "--all", "--always"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
    } catch {
      /* a detached worktree with no ref name is fine */
    }
    return { commit, describe };
  } catch {
    return { commit: "unknown", describe: "" };
  }
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith(".json") && !entry.name.endsWith(".dbg.json"))
      yield p;
  }
}

function canonicalType(input) {
  if (input.type.startsWith("tuple")) {
    const inner = "(" + input.components.map(canonicalType).join(",") + ")";
    return inner + input.type.slice("tuple".length);
  }
  return input.type;
}

function selectorOf(signature) {
  const hash = keccak_256(new TextEncoder().encode(signature));
  return "0x" + Buffer.from(hash.slice(0, 4)).toString("hex");
}

function skip(sourceName, contractName) {
  if (!sourceName) return false;
  // Only the protocol's own sources: OpenZeppelin bases (AccessControl,
  // TimelockController, ...) surface through the contracts that inherit them.
  if (!sourceName.startsWith("contracts/")) return true;
  if (sourceName.startsWith("contracts/test/")) return true;
  if (sourceName.includes("/interfaces/")) return true;
  if (contractName.startsWith("Legacy")) return true;
  return false;
}

const candidates = new Map(); // selector -> Set<"Contract.fn(types)">
let files = 0;
for (const dir of dirs) {
  for (const file of walk(dir)) {
    let artifact;
    try {
      artifact = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const abi = Array.isArray(artifact) ? artifact : artifact.abi;
    if (!Array.isArray(abi)) continue;
    const contractName = artifact.contractName || path.basename(file, ".json");
    if (skip(artifact.sourceName || "", contractName)) continue;
    files++;
    for (const item of abi) {
      if (item.type !== "function") continue;
      const signature =
        item.name +
        "(" +
        (item.inputs || []).map(canonicalType).join(",") +
        ")";
      const selector = selectorOf(signature);
      if (!candidates.has(selector)) candidates.set(selector, new Set());
      candidates.get(selector).add(contractName + "." + signature);
    }
  }
}

const rows = [...candidates.entries()]
  .map(([selector, names]) => [selector, [...names].sort()[0]])
  .sort((a, b) => (a[0] < b[0] ? -1 : 1));

const sources = dirs.map((dir) => {
  const ref = gitRefOf(dir);
  return { commit: ref.commit, ref: ref.describe };
});
const digest = crypto
  .createHash("sha256")
  .update(rows.map(([sel, name]) => `${sel} ${name}`).join("\n"))
  .digest("hex");

const lines = [];
lines.push("// GENERATED FILE — do not edit by hand.");
lines.push(
  "// Regenerate with: node scripts/generate-selectors.mjs <contracts-v4>/artifacts",
);
lines.push(
  `// Sources: ${files} contract artifacts, ${rows.length} unique selectors.`,
);
for (const src of sources) {
  lines.push(`//   ${src.commit}${src.ref ? ` (${src.ref})` : ""}`);
}
lines.push(`// Digest: ${digest}`);
lines.push("");
lines.push("/** contracts-v4 commits this map was generated from. */");
lines.push(
  `export const SELECTOR_SOURCE_COMMITS: string[] = [${sources
    .map((src) => `"${src.commit}"`)
    .join(", ")}];`,
);
lines.push("");
lines.push("/** sha256 over the sorted `<selector> <name>` pairs below. */");
lines.push(`export const SELECTOR_MAP_DIGEST = "${digest}";`);
lines.push("");
lines.push("const SELECTOR_KEYS: string[] = [");
for (const [selector] of rows) lines.push(`  "${selector}",`);
lines.push("];");
lines.push("");
lines.push("const SELECTOR_NAMES: string[] = [");
for (const [, name] of rows) lines.push(`  "${name}",`);
lines.push("];");
lines.push("");
lines.push("/**");
lines.push(
  " * Resolves a lowercase 0x-prefixed bytes4 hex string to `Contract.fn(types)`.",
);
lines.push(' * Returns "" for selectors the generator did not know about.');
lines.push(" */");
lines.push(
  "export function selectorFunctionName(selectorHex: string): string {",
);
lines.push("  for (let i = 0; i < SELECTOR_KEYS.length; i++) {");
lines.push(
  "    if (SELECTOR_KEYS[i] == selectorHex) return SELECTOR_NAMES[i];",
);
lines.push("  }");
lines.push('  return "";');
lines.push("}");
lines.push("");

fs.writeFileSync(outFile, lines.join("\n"));
fs.writeFileSync(
  metaFile,
  JSON.stringify(
    {
      selectorCount: rows.length,
      artifactCount: files,
      digest,
      sources,
      selectors: Object.fromEntries(rows),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `wrote ${rows.length} selectors from ${files} artifacts to ${path.relative(root, outFile)}`,
);
console.log(
  `  sources: ${sources.map((src) => src.commit.slice(0, 10)).join(", ")} · digest ${digest.slice(0, 12)}`,
);
