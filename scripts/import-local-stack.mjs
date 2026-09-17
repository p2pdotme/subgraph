#!/usr/bin/env node
/**
 * Imports a contracts-v4 `local:deploy` output into this repo's networks.json
 * as the `localhost` network (docs/runbooks/local-stack.md in contracts-v4).
 *
 * Usage:
 *   node scripts/import-local-stack.mjs ../contracts-v4/deployments/1337/local-stack.json
 *   graph build --network localhost
 *
 * Every data source in subgraph.yaml is mapped to the address it lives at on
 * the local stack: main-Diamond facets → the Diamond, Insurance facets → the
 * Insurance Diamond, ReputationManager → itself. The GovernorFacet is not part
 * of the local stack, so it is left out (it keeps its manifest address).
 * LeadTimelocks need no entry: the template is instantiated from
 * RoleTimelockSet events.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const stackFile = process.argv[2];
if (!stackFile) {
  console.error(
    "usage: node scripts/import-local-stack.mjs <local-stack.json>",
  );
  process.exit(1);
}
const stack = JSON.parse(fs.readFileSync(stackFile, "utf8"));
const { diamond, insuranceDiamond, reputationManager } = stack.addresses;
const startBlock = stack.deployedAtBlock;

const manifest = fs.readFileSync(path.join(root, "subgraph.yaml"), "utf8");
const dataSources = [];
const sections = manifest.split(/^templates:/m)[0];
for (const m of sections.matchAll(
  /- kind: ethereum\n\s+name: (\w+)\n\s+network: \w+\n\s+source:\n\s+address: "(0x[0-9a-fA-F]{40})"/g,
)) {
  dataSources.push({ name: m[1], address: m[2].toLowerCase() });
}

const BASE_MAIN = "0x4cad6ec90e65babec9335cad728ddc610c316368";
const BASE_INSURANCE = "0x17192bd2e8893e4ea0ab5db67adbf38ae42e9931";
const BASE_RM = "0xcf613e08ee1b4c2669ddcf06a7d22c9856f6aa1d";

const localhost = {};
for (const ds of dataSources) {
  let address;
  if (ds.address === BASE_MAIN) address = diamond;
  else if (ds.address === BASE_INSURANCE) address = insuranceDiamond;
  else if (ds.address === BASE_RM) address = reputationManager;
  else continue; // GovernorFacet: not deployed by local:deploy
  localhost[ds.name] = { address, startBlock };
}

const networksPath = path.join(root, "networks.json");
const networks = JSON.parse(fs.readFileSync(networksPath, "utf8"));
networks.localhost = localhost;
fs.writeFileSync(networksPath, JSON.stringify(networks, null, 2) + "\n");
console.log(
  `networks.json: wrote ${Object.keys(localhost).length} localhost data sources (block ${startBlock})`,
);
