import { Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { dataFreshnessTool, updateDataFreshness } from '../tools/data-freshness';
import { webSearchTool, fetchUrlContentTool } from '../tools';
import { ToolExecutionContext } from '@mastra/core/tools';

const workflowInputSchema = z.object({
  dataType: z.enum(['items', 'trinkets', 'tier-sets', 'mythic-plus', 'pvp']),
  gameMode: z.string(),
  characterClass: z.string(),
  spec: z.string().optional(),
  characterGear: z.array(z.object({
    slot: z.string(),
    name: z.string(),
    itemLevel: z.number(),
  })),
  forceUpdate: z.boolean().optional(),
});

const checkDataFreshnessSchema = {
  input: workflowInputSchema,
  output: z.object({
    isFresh: z.boolean(),
    lastUpdated: z.string(),
    needsUpdate: z.boolean(),
    dataType: z.string().optional(),
    gameMode: z.string().optional(),
    characterClass: z.string().optional(),
    spec: z.string().optional(),
    characterGear: z.array(z.object({
      slot: z.string(),
      name: z.string(),
      itemLevel: z.number(),
    })).optional(),
    forceUpdate: z.boolean().optional(),
  }),
};

const fetchFreshDataSchema = {
  input: checkDataFreshnessSchema.output,
  output: z.object({
    recommendations: z.array(z.object({
      itemName: z.string(),
      source: z.string(),
      acquisition: z.string(),
      priority: z.string(),
    })),
    characterGear: z.array(z.object({
      slot: z.string(),
      name: z.string(),
      itemLevel: z.number(),
    })).optional(),
    gameMode: z.string().optional(),
  }),
};

const filterRecommendationsSchema = {
  input: workflowInputSchema,
  output: z.object({
    filteredRecommendations: z.array(z.object({
      itemName: z.string(),
      source: z.string(),
      acquisition: z.string(),
      priority: z.string(),
      reason: z.string(),
    })),
  }),
};

const checkDataFreshness = {
  id: 'check-data-freshness',
  description: 'Check if our item data is fresh',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    isFresh: z.boolean(),
    lastUpdated: z.string(),
    needsUpdate: z.boolean(),
  }),
  execute: async (params: any) => {
    const { context } = params;
    const { dataType, forceUpdate } = context.triggerData;
    const result = await dataFreshnessTool.execute({
      inputData: { dataType, forceUpdate },
      context: {},
      runtimeContext: new Map(),
    } as unknown as ToolExecutionContext<typeof dataFreshnessTool.inputSchema>);
    return {
      isFresh: result.isFresh,
      lastUpdated: result.lastUpdated,
      needsUpdate: result.needsUpdate,
    };
  },
};

const fetchFreshData = {
  id: 'fetch-fresh-data',
  description: 'Fetch fresh item data from the web',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    recommendations: z.array(z.object({
      itemName: z.string(),
      source: z.string(),
      acquisition: z.string(),
      priority: z.string(),
    })),
  }),
  execute: async (params: any) => {
    const { context } = params;
    const { dataType, gameMode, characterClass, spec } = context.triggerData;
    const searchQuery = `${characterClass} ${spec || ''} ${dataType} ${gameMode} guide 11.1.5`;
    const searchResults = await webSearchTool.execute({
      inputData: { query: searchQuery, limit: 3 },
      context: {},
      runtimeContext: new Map(),
    } as unknown as ToolExecutionContext<typeof webSearchTool.inputSchema>);
    const recommendations = [];
    for (const result of searchResults) {
      const content = await fetchUrlContentTool.execute({
        inputData: { url: result.link },
        context: {},
        runtimeContext: new Map(),
      } as unknown as ToolExecutionContext<typeof fetchUrlContentTool.inputSchema>);
      if (content.error) continue;
      const lines = content.content?.split('\n') || [];
      for (const line of lines) {
        if (line.toLowerCase().includes('recommended') || line.toLowerCase().includes('bis')) {
          recommendations.push({
            itemName: line.split('-')[0]?.trim() || 'Unknown',
            source: result.title,
            acquisition: line.split('-')[1]?.trim() || 'Unknown',
            priority: line.toLowerCase().includes('bis') ? 'BiS' : 'Recommended',
          });
        }
      }
    }
    await updateDataFreshness(dataType, searchResults[0]?.title || 'Unknown');
    return { recommendations };
  },
};

const filterRecommendations = {
  id: 'filter-recommendations',
  description: 'Filter and rank recommendations based on character data',
  inputSchema: workflowInputSchema,
  outputSchema: filterRecommendationsSchema.output,
  execute: async (params: any) => {
    const { context } = params;
    const recommendations = context.getStepResult('fetch-fresh-data')?.recommendations || [];
    const gameMode = context.triggerData.gameMode;
    const filteredRecommendations = recommendations.map((rec: any) => ({
      ...rec,
      reason: `Recommended for ${gameMode} content`,
    }));
    return { filteredRecommendations };
  },
};

const routeStep = {
  id: 'route-step',
  description: 'Route to fetchFreshData or filterRecommendations based on freshness',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({}),
  execute: async (params: any) => {
    return {};
  },
  next: (params: any) => {
    const { context } = params;
    const needsUpdate = context.getStepResult('check-data-freshness')?.needsUpdate;
    return needsUpdate ? fetchFreshData : filterRecommendations;
  },
};

const itemRecommendationWorkflow = new Workflow({
  id: 'item-recommendation',
  inputSchema: workflowInputSchema,
  outputSchema: filterRecommendationsSchema.output,
  steps: [checkDataFreshness, routeStep],
})
  .then(filterRecommendations);

itemRecommendationWorkflow.commit();

export { itemRecommendationWorkflow }; 