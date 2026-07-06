#!/usr/bin/env node
// Finds CircleMerchant rows whose non-null `circle` link points at a Circle
// that was never saved (the cause of:
//   "Null value resolved for non-null field `circle`").
//
// It never selects the nested `circle { ... }` field (that is what throws),
// so the query always succeeds. It instead:
//   1. pages every existing Circle id,
//   2. asks the subgraph for CircleMerchants whose foreign-key `circle` is
//      NOT in that set (server-side `circle_not_in` filter) — those dangle.
//
// Usage:
//   node scripts/find-dangling-circle-merchants.mjs [endpoint]
// or:
//   SUBGRAPH_URL=https://... node scripts/find-dangling-circle-merchants.mjs

const ENDPOINT =
  process.argv[2] ||
  process.env.SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmq7kbyqt81p501xi7h0wdeuh/subgraphs/p2pme-subgraph/0.2.7/gn";

const PAGE = 1000;

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

// Cursor pagination on `id` (skip is capped server-side, id_gt is stable).
async function pageAll(entity, fields, extraWhere = {}) {
  const out = [];
  let cursor = "";
  for (;;) {
    const data = await gql(
      `query Page($first: Int!, $where: ${entity === "circles" ? "Circle" : "CircleMerchant"}_filter) {
         rows: ${entity}(first: $first, orderBy: id, orderDirection: asc, where: $where) {
           ${fields}
         }
       }`,
      { first: PAGE, where: { ...extraWhere, id_gt: cursor } },
    );
    const rows = data.rows;
    out.push(...rows);
    if (rows.length < PAGE) break;
    cursor = rows[rows.length - 1].id;
  }
  return out;
}

async function main() {
  console.log("Endpoint:", ENDPOINT);

  const circles = await pageAll("circles", "id");
  const circleIds = circles.map((c) => c.id);
  console.log(`Existing Circle entities: ${circleIds.length}`);

  // CircleMerchants whose `circle` foreign key is not any existing Circle.
  const dangling = await pageAll(
    "circleMerchants",
    "id\n           merchant\n           circleId",
    circleIds.length ? { circle_not_in: circleIds } : {},
  );

  if (dangling.length === 0) {
    console.log("\nNo dangling CircleMerchant.circle links found. ✅");
    return;
  }

  console.log(
    `\nFound ${dangling.length} CircleMerchant row(s) with a dangling circle link:\n`,
  );
  for (const m of dangling) {
    console.log(
      `  merchant=${m.merchant}  circleId=${m.circleId}  (CircleMerchant id=${m.id})`,
    );
  }
  console.log(
    "\nThese are why the `circleMerchants { circle { ... } }` list query fails:",
  );
  console.log(
    "a single dangling row nullifies the whole non-null list. circleId=0 rows",
  );
  console.log(
    "are the default-initialized links (loadCircleMerchant) that were never registered.",
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
