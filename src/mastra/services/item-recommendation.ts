import { z } from 'zod';
import { dataFreshnessTool, updateDataFreshness } from '../tools/data-freshness';
import { webSearchTool, fetchUrlContentTool } from '../tools';
import { ToolExecutionContext } from '@mastra/core/tools';

export interface ItemRecommendation {
  itemName: string;
  source: string;
  acquisition: string;
  priority: string;
  reason?: string;
}

export interface CharacterGear {
  slot: string;
  name: string;
  itemLevel: number;
}

export class ItemRecommendationService {
  private static instance: ItemRecommendationService;
  
  private constructor() {}
  
  public static getInstance(): ItemRecommendationService {
    if (!ItemRecommendationService.instance) {
      ItemRecommendationService.instance = new ItemRecommendationService();
    }
    return ItemRecommendationService.instance;
  }

  public async getRecommendations(params: {
    dataType: 'items' | 'trinkets' | 'tier-sets' | 'mythic-plus' | 'pvp';
    gameMode: string;
    characterClass: string;
    spec?: string;
    characterGear: CharacterGear[];
    forceUpdate?: boolean;
  }): Promise<ItemRecommendation[]> {
    const { dataType, gameMode, characterClass, spec, characterGear, forceUpdate = false } = params;

    // Step 1: Check data freshness
    const freshnessResult = await dataFreshnessTool.execute({
      inputData: { dataType, forceUpdate },
      context: {},
      runtimeContext: new Map(),
    } as unknown as ToolExecutionContext<typeof dataFreshnessTool.inputSchema>);

    // If data is fresh and we're not forcing an update, return cached recommendations
    if (freshnessResult.isFresh && !forceUpdate) {
      return this.getCachedRecommendations(dataType);
    }

    // Step 2: Fetch fresh data
    const searchQuery = `${characterClass} ${spec || ''} ${dataType} ${gameMode} guide 11.1.5`;
    const searchResults = await webSearchTool.execute({
      inputData: { query: searchQuery, limit: 3 },
      context: {},
      runtimeContext: new Map(),
    } as unknown as ToolExecutionContext<typeof webSearchTool.inputSchema>);

    const recommendations: ItemRecommendation[] = [];

    // Process each search result
    for (const result of searchResults) {
      const content = await fetchUrlContentTool.execute({
        inputData: { url: result.link },
        context: {},
        runtimeContext: new Map(),
      } as unknown as ToolExecutionContext<typeof fetchUrlContentTool.inputSchema>);

      if (content.error) continue;

      // Extract recommendations from content
      const lines = content.content?.split('\n') || [];
      for (const line of lines) {
        if (line.toLowerCase().includes('recommended') || line.toLowerCase().includes('bis')) {
          recommendations.push({
            itemName: line.split('-')[0]?.trim() || 'Unknown',
            source: result.title,
            acquisition: line.split('-')[1]?.trim() || 'Unknown',
            priority: line.toLowerCase().includes('bis') ? 'BiS' : 'Recommended',
            reason: `Recommended for ${gameMode} content`,
          });
        }
      }
    }

    // Step 3: Filter and rank recommendations
    const filteredRecommendations = this.filterRecommendations(recommendations, characterGear, gameMode);

    // Update freshness data
    await updateDataFreshness(dataType, searchResults[0]?.title || 'Unknown');

    // Cache the recommendations
    await this.cacheRecommendations(dataType, filteredRecommendations);

    return filteredRecommendations;
  }

  private async getCachedRecommendations(dataType: string): Promise<ItemRecommendation[]> {
    // TODO: Implement caching logic
    return [];
  }

  private async cacheRecommendations(dataType: string, recommendations: ItemRecommendation[]): Promise<void> {
    // TODO: Implement caching logic
  }

  private filterRecommendations(
    recommendations: ItemRecommendation[],
    characterGear: CharacterGear[],
    gameMode: string
  ): ItemRecommendation[] {
    return recommendations.map(rec => ({
      ...rec,
      reason: `Recommended for ${gameMode} content`,
    }));
  }
} 