# Mastra Upgrade Plan: 0.x → 1.x

## Current vs latest

| Package | Current (0.x) | Latest (1.x) |
|---------|----------------|--------------|
| mastra (CLI) | ^0.11.2 | **1.3.7** |
| @mastra/core | ^0.15.2 | **1.10.0** |
| @mastra/memory | ^0.14.2 | **1.6.1** |
| @mastra/mcp | ^0.11.2 | **1.1.0** |
| @mastra/mcp-docs-server | ^0.13.16 | **1.1.8** |
| @mastra/fastembed | ^0.10.4 | **1.0.1** |
| @mastra/libsql | ^0.13.7 | **1.6.4** |
| @mastra/loggers | ^0.10.9 | **1.0.2** |

**Conclusion:** The app is on Mastra **0.x**. The latest line is **1.x** (released Jan 2026). This plan is for upgrading to 1.x.

---

## Prerequisites

- **Node.js:** Mastra v1 requires **Node.js 22.13.0+**. Current environment (v24.0.1) is fine.
- **Pre-migration:** Official docs recommend [upgrading to latest 0.x](https://mastra.ai/guides/migrations/upgrade-to-latest-0x) first, then doing the v1 migration.

---

## Upgrade strategy

1. **Option A (recommended):** Upgrade to latest 0.x, run tests, then upgrade all Mastra packages to `@latest` in one go.
2. **Option B:** Upgrade directly to 1.x (higher risk; run codemods and fix breaking changes in one pass).

Update **all** `@mastra/*` and `mastra` together to avoid version skew.

```bash
# After backing up and from repo root
npm install @mastra/core@latest @mastra/loggers@latest @mastra/memory@latest \
  @mastra/mcp@latest @mastra/mcp-docs-server@latest @mastra/fastembed@latest \
  @mastra/libsql@latest mastra@latest
```

---

## Code changes required (from this codebase)

### 1. Tools – `createTool` execute signature (high impact)

**Current:** `execute: async ({ context })` with input on `context`.

**v1:** `execute: async (inputData, context)` — first argument is typed from `inputSchema`, second is execution context.

| File | Change |
|------|--------|
| `src/mastra/tools/index.ts` | `wowCharacterGearTool`, `webSearchTool`, `fetchUrlContentTool`: use `(inputData, context)` and read inputs from `inputData` (e.g. `inputData.characterName`, `inputData.serverName`, `inputData.region`). |
| `src/mastra/tools/bisTool.ts` | Same: `execute: async (inputData, context)` and use `inputData.spec`, `inputData.cls`, etc. |

Example for one tool:

```diff
- execute: async ({ context }) => {
-   return await getWoWCharacterGear(context.characterName, context.serverName, context.region);
- },
+ execute: async (inputData, context) => {
+   return await getWoWCharacterGear(inputData.characterName, inputData.serverName, inputData.region);
+ },
```

- If you use `requestContext`: v1 uses `context?.requestContext` (replaces `runtimeContext`).

### 2. Agent `generate` – `threadId` / `resourceId` → `memory` (high impact)

**File:** `src/mastra/index.ts`

**Current:** `wowCharacterGearAgent.generate(cleanMessage, { resourceId, threadId, temperature, maxSteps })`

**v1:** Use `memory: { thread, resource }` instead of `threadId` / `resourceId`.

```diff
- const result = await wowCharacterGearAgent.generate(cleanMessage, {
-   resourceId: message.author.id,
-   threadId: `discord-${message.author.id}`,
-   temperature,
-   ...(maxSteps && { maxSteps }),
- });
+ const result = await wowCharacterGearAgent.generate(cleanMessage, {
+   memory: {
+     resource: message.author.id,
+     thread: `discord-${message.author.id}`,
+   },
+   temperature,
+   ...(maxSteps && { maxSteps }),
+ });
```

### 3. Agent – required `id` (medium impact)

**File:** `src/mastra/agents/index.ts`

**v1:** Agent config must include `id`.

```diff
 export const wowCharacterGearAgent = new Agent({
+  id: 'wow-character-gear-agent',
   name: 'WoW Character Gear Agent',
   instructions: `...`,
```

### 4. Memory config – `threads.generateTitle` (low impact)

**File:** `src/mastra/agents/index.ts`

**v1:** `generateTitle` is top-level under `options`, not under `threads`.

```diff
   options: {
     lastMessages: memoryMaxMessages,
     ...
-    threads: {
-      generateTitle: true,
-    }
+    generateTitle: true,
   }
```

No other memory API is used in this repo (e.g. no `memory.query()` → `memory.recall()` in app code).

### 5. Storage – LibSQLStore `id` (medium impact)

**File:** `src/mastra/storage.ts`

**v1:** Storage instances require an `id`.

```diff
 export const storage = new LibSQLStore({
+  id: 'main-libsql',
   url: 'file:../../memory.db',
 })
```

### 6. Database migration (LibSQL)

- If you use **evals/scorers** and have a `runtimeContext` column: rename/copy to `requestContext` (see [Storage migration](https://mastra.ai/guides/migrations/upgrade-to-v1/storage)).
- **Spans:** If you have existing `mastra_spans` data from before v1, run once:
  ```bash
  npx mastra migrate
  ```
  (or use the programmatic migration described in the storage guide).

### 7. Optional / if used later

- **Mastra class:** `mastra.getAgents()` → `mastra.listAgents()`.
- **Agent property access:** Prefer getters: `agent.getLLM()`, `agent.getTools()`, `agent.getInstructions()` instead of `agent.llm`, etc.
- **Imports:** v1 prefers subpath imports from `@mastra/core` (you already use e.g. `@mastra/core/tools`, `@mastra/core/agent`, `@mastra/core/mastra`); confirm after upgrade that these paths still work and update if docs show new paths.

---

## Codemods (run after installing 1.x)

Run from repo root to automate many renames and patterns:

```bash
# Run all v1 codemods (recommended first pass)
npx @mastra/codemod@latest v1 .

# Or run specific codemods
npx @mastra/codemod@latest v1/runtime-context .
npx @mastra/codemod@latest v1/mastra-plural-apis .
npx @mastra/codemod@latest v1/agent-property-access .
npx @mastra/codemod@latest v1/memory-query-to-recall .
npx @mastra/codemod@latest v1/memory-readonly-to-options .
```

Then fix remaining breaks by hand (especially tool `execute` signatures and `generate` options above).

---

## Tool output validation (v1 behavior)

Tools with `outputSchema` now **validate** return values. If the returned object doesn’t match the schema, the tool returns a `ValidationError` instead of the invalid data. Ensure all tool return values match their `outputSchema` (e.g. in `src/mastra/tools/index.ts` and `bisTool.ts`) to avoid runtime validation errors.

---

## Testing checklist

- [ ] `npm run build` succeeds.
- [ ] `npm test` and `npm run test:memory` pass.
- [ ] Discord adapter: send a message and confirm the agent responds (memory/thread/resource).
- [ ] WoW tools: character gear and BiS scrape return expected shapes.
- [ ] MCP tools (e.g. Brave search) still work if used in the agent.

---

## Reference

- [Upgrade to Mastra v1 – Overview](https://mastra.ai/guides/migrations/upgrade-to-v1/overview)
- [Tools migration](https://mastra.ai/guides/migrations/upgrade-to-v1/tools)
- [Agent migration](https://mastra.ai/guides/migrations/upgrade-to-v1/agent)
- [Memory migration](https://mastra.ai/guides/migrations/upgrade-to-v1/memory)
- [Storage migration](https://mastra.ai/guides/migrations/upgrade-to-v1/storage)
