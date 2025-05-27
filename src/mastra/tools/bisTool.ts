// src/mastra/tools/bisTool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fetch } from "undici";
import { load, Cheerio } from "cheerio";

/* ---------- internal helpers ---------- */
const BASE = "https://www.icy-veins.com/wow/";
const slugify = (spec: string, cls: string, role = "") =>
  [
    spec.toLowerCase().replace(/ /g, "-"),
    cls.toLowerCase().replace(/ /g, "-"),
    role ? `pve-${role.toLowerCase()}` : null,
    "gear-best-in-slot",
  ]
    .filter(Boolean)
    .join("-");

const scrapeIcyVeins = async (spec: string, cls: string, role = "") => {
  const url = `${BASE}${slugify(spec, cls, role)}`;
  console.log(`[BiS Debug] Fetching URL:`, url);
  const html = await (await fetch(url)).text();
  const $ = load(html);

  // Find the heading containing 'Overall BiS Gear' (case-insensitive)
  const header = $("h2, h3").filter((_, el) =>
    $(el).text().toLowerCase().includes("overall bis gear")
  ).first();
  console.log(`[BiS Debug] Header found:`, header.length > 0);
  if (!header.length) {
    console.error(`[BiS Debug] BiS header not found for URL:`, url);
    throw new Error("BiS header not found");
  }

  // Find the first table after the header
  let table = header.next();
  let debugSteps = 0;
  while (table.length && table[0].name !== "table" && debugSteps < 5) {
    console.log(`[BiS Debug] Sibling after header [${debugSteps}]:`, table[0]?.name, table.html()?.slice(0, 120));
    table = table.next();
    debugSteps++;
  }
  console.log(`[BiS Debug] Table found after header:`, table.length > 0 && table[0].name === "table");
  if (!table.length || table[0].name !== "table") {
    // Fallback: search for the first table after the header in the DOM order
    const headerIndex = $("*").index(header);
    let foundTable: Cheerio<any> | null = null;
    $("table").each((_, el) => {
      if ($("*").index(el) > headerIndex && !foundTable) {
        foundTable = $(el);
      }
    });
    if (foundTable) {
      console.log(`[BiS Debug] Fallback: found table after header in DOM order.`);
      table = foundTable;
    } else {
      console.error(`[BiS Debug] BiS table not found after header for URL:`, url);
      throw new Error("BiS table not found after header");
    }
  }

  const bis: Record<string, string> = {};
  let rowCount = 0;
  table.find("tr").slice(1).each((_, row) => {
    const cols = $(row).find("td");
    if (cols.length >= 2) {
      const slot = $(cols[0]).text().trim();
      const item = $(cols[1]).text().trim();
      if (slot && item) bis[slot] = item;
      rowCount++;
    }
  });
  console.log(`[BiS Debug] Parsed rows:`, rowCount);

  return { spec, class: cls, role, source: url, bis };
};

/* ---------- Mastra tool ---------- */
export const bisScraperTool = createTool({
  id: "bis.scrape",
  description:
    "Return the 'Overall BiS Gear' table for a given spec/class/role (Patch 11.1.5) using Icy-Veins.",
  inputSchema: z.object({
    spec: z.string(),
    cls: z.string(),
    role: z.enum(["tank", "healing", "dps"]).optional(),
  }),
  outputSchema: z.object({
    spec: z.string(),
    class: z.string(),
    role: z.string().nullable(),
    source: z.string().url(),
    bis: z.record(z.string(), z.string()),
  }),
  execute: async ({ context }) => scrapeIcyVeins(context.spec, context.cls, context.role),
});
