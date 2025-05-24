import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

interface DataFreshnessInfo {
  lastUpdated: string;
  patchVersion: string;
  dataType: string;
  source: string;
}

const dataFreshnessTool = createTool({
  id: 'check-data-freshness',
  description: 'Check and update the freshness of WoW data sources',
  inputSchema: z.object({
    dataType: z.enum(['items', 'trinkets', 'tier-sets', 'mythic-plus', 'pvp']).describe('Type of data to check'),
    forceUpdate: z.boolean().default(false).describe('Force update even if data is recent'),
  }),
  outputSchema: z.object({
    isFresh: z.boolean(),
    lastUpdated: z.string(),
    patchVersion: z.string(),
    dataType: z.string(),
    source: z.string(),
    needsUpdate: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { dataType, forceUpdate } = context;
    const dataDir = path.join(process.cwd(), 'data');
    const freshnessFile = path.join(dataDir, 'freshness.json');

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize or load freshness data
    let freshnessData: Record<string, DataFreshnessInfo> = {};
    if (fs.existsSync(freshnessFile)) {
      freshnessData = JSON.parse(fs.readFileSync(freshnessFile, 'utf-8'));
    }

    const currentData = freshnessData[dataType] || {
      lastUpdated: new Date(0).toISOString(),
      patchVersion: '11.1.5',
      dataType,
      source: 'unknown',
    };

    // Check if data needs update (older than 24 hours or forced)
    const lastUpdate = new Date(currentData.lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    const needsUpdate = forceUpdate || hoursSinceUpdate >= 24;

    return {
      isFresh: !needsUpdate,
      lastUpdated: currentData.lastUpdated,
      patchVersion: currentData.patchVersion,
      dataType,
      source: currentData.source,
      needsUpdate,
    };
  },
});

const updateDataFreshness = async (dataType: string, source: string) => {
  const dataDir = path.join(process.cwd(), 'data');
  const freshnessFile = path.join(dataDir, 'freshness.json');

  let freshnessData: Record<string, DataFreshnessInfo> = {};
  if (fs.existsSync(freshnessFile)) {
    freshnessData = JSON.parse(fs.readFileSync(freshnessFile, 'utf-8'));
  }

  freshnessData[dataType] = {
    lastUpdated: new Date().toISOString(),
    patchVersion: '11.1.5',
    dataType,
    source,
  };

  fs.writeFileSync(freshnessFile, JSON.stringify(freshnessData, null, 2));
};

export { dataFreshnessTool, updateDataFreshness }; 