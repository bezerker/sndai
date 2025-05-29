// src/mastra/tools/bisTool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { fetch } from "undici";
import { load, Cheerio } from "cheerio";
import { getRoleForSpecId } from './specRoleMap';

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

  // Debug: Print all h2/h3 headings on the page
  console.log('[BiS Debug] All h2/h3 headings on the page:');
  $("h2, h3").each((_, el) => {
    console.log('-', $(el).text().trim());
  });

  // Find the heading containing a BiS-related phrase (case-insensitive)
  const header = $("h2, h3").filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return (
      text.includes("overall bis gear") ||
      text.includes("best in slot gear guide") ||
      text.includes("bis gear for") ||
      text.includes("best gear for") ||
      text.includes("best in slot") ||
      text.includes("bis") ||
      text.includes("overall bis list for season")
    );
  }).first();
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
    specId: z.preprocess(val => typeof val === 'string' ? parseInt(val, 10) : val, z.number().optional()),
    role: z.preprocess(val => typeof val === 'string' ? val.toLowerCase() : val, z.enum(["tank", "healing", "dps"]).optional()),
  }),
  outputSchema: z.object({
    spec: z.string(),
    class: z.string(),
    role: z.string().nullable(),
    source: z.string().url(),
    bis: z.record(z.string(), z.string()),
  }),
  execute: async ({ context }) => {
    let { spec, cls, specId, role } = context;
    console.log('[BiS Debug] Received input:', { spec, cls, specId, role, typeofSpecId: typeof specId, typeofRole: typeof role });
    if (!role && specId !== undefined) {
      role = getRoleForSpecId(specId);
      if (!role) {
        console.warn(`[BiS Debug] Could not auto-determine role for specId: ${specId}`);
      } else {
        console.log(`[BiS Debug] Auto-filled role for specId ${specId}: ${role}`);
      }
    }
    if (!role) {
      throw new Error(`Role could not be determined for specId: ${specId}. Please provide a valid specId or role.`);
    }
    return scrapeIcyVeins(spec, cls, role);
  },
});
