import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';
import { extract } from '@extractus/article-extractor';
// @ts-ignore
import * as googleSr from 'google-sr';
import { dataFreshnessTool } from './data-freshness';

interface WoWCharacterResponse {
  name: string;
  realm: {
    name: string;
    slug: string;
  };
  level: number;
  character_class: {
    name: string;
  };
  race: {
    name: string;
  };
  gender: {
    name: string;
  };
  equipped_items: Array<{
    slot: {
      name: string;
    };
    item: {
      name: string;
      quality: {
        name: string;
      };
      level: number;
    };
  }>;
}

const wowCharacterGearTool = createTool({
  id: 'get-wow-character-gear',
  description: 'Get World of Warcraft character information and gear by name and server',
  inputSchema: z.object({
    characterName: z.string().describe('Character name'),
    serverName: z.string().describe('Server name'),
    region: z.string().default('us').describe('Region (us, eu, etc.)'),
  }),
  outputSchema: z.object({
    name: z.string(),
    server: z.string(),
    level: z.number(),
    class: z.string(),
    race: z.string(),
    gender: z.string(),
    guild: z.string(),
    gear: z.array(z.object({
      slot: z.string(),
      name: z.string(),
      quality: z.string(),
      itemLevel: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    return await getWoWCharacterGear(context.characterName, context.serverName, context.region);
  },
});

const getWoWCharacterGear = async (characterName: string, serverName: string, region: string) => {
  try {
    // Normalize character name and server name
    const normalizedCharacterName = characterName
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase();

    const normalizedServerName = serverName
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase();

    console.log('Input values:', {
      originalCharacterName: characterName,
      normalizedCharacterName,
      originalServerName: serverName,
      normalizedServerName,
      region
    });

    // Get OAuth token
    console.log('Fetching OAuth token...');
    const tokenResponse = await fetch(`https://${region}.battle.net/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      console.error('Failed to get OAuth token:', await tokenResponse.text());
      throw new Error(`Failed to get OAuth token: ${tokenResponse.statusText}`);
    }

    const { access_token } = await tokenResponse.json();
    console.log('Successfully obtained OAuth token');

    // Try to get character data directly
    const characterUrl = `https://${region}.api.blizzard.com/profile/wow/character/${normalizedServerName}/${normalizedCharacterName}?namespace=profile-${region}&locale=en_US`;
    console.log('Attempting character lookup:', characterUrl.replace(/access_token=[^&]*/, 'access_token=REDACTED'));

    const characterResponse = await fetch(characterUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!characterResponse.ok) {
      const errorText = await characterResponse.text();
      console.error('Failed to fetch character data:', errorText);
      throw new Error(`Failed to fetch character data: ${characterResponse.statusText}\n${errorText}`);
    }

    const characterData = await characterResponse.json();
    console.log('Successfully fetched character data from profile API');

    // Get equipped items
    const equippedItemsUrl = `https://${region}.api.blizzard.com/profile/wow/character/${normalizedServerName}/${normalizedCharacterName}/equipment?namespace=profile-${region}&locale=en_US`;

    const equippedItemsResponse = await fetch(equippedItemsUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    console.log('Equipped items response:', equippedItemsResponse);

    if (!equippedItemsResponse.ok) {
      const errorText = await equippedItemsResponse.text();
      console.error('Failed to fetch equipped items:', errorText);
      throw new Error(`Failed to fetch equipped items: ${equippedItemsResponse.statusText}\n${errorText}`);
    }

    const equippedItemsData = await equippedItemsResponse.json();
    // logDebug('Equipped items data: ' + JSON.stringify(equippedItemsData, null, 2));
    console.log('Successfully fetched equipped items');

    // Process equipped items with proper error handling
    const gear = equippedItemsData.equipped_items?.map((item: any) => ({
      slot: item.slot?.name || 'Unknown',
      name: item.name || 'Unknown',
      quality: item.quality?.name || 'Unknown',
      itemLevel: item.level?.value || 0,
    })) || [];

    return {
      name: characterData.name,
      server: characterData.realm?.name || normalizedServerName,
      level: characterData.level || 0,
      class: characterData.character_class?.name || 'Unknown',
      race: characterData.race?.name || 'Unknown',
      gender: characterData.gender?.name || 'Unknown',
      guild: characterData.guild?.name || 'Unknown',
      gear,
    };
  } catch (error) {
    console.error('Error in getWoWCharacterGear:', error);
    throw error;
  }
};

const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web using Google and return top results (no API key required)',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().min(1).max(10).default(5).describe('Number of results to return (default 5, max 10)'),
  }),
  outputSchema: z.array(z.object({
    title: z.string(),
    link: z.string(),
    snippet: z.string().optional(),
  })),
  execute: async ({ context }) => {
    const { query, limit } = context;
    try {
      const results: any[] = await googleSr.search({ query });
      logDebug('Raw google-sr results: ' + JSON.stringify(results, null, 2));
      return results.slice(0, limit || 5).map((r: any) => ({
        title: r.title,
        link: r.link,
        snippet: r.description || '',
      }));
    } catch (err) {
      const error = err as Error;
      logDebug('google-sr error: ' + (error.stack || error));
      throw err;
    }
  },
});

const fetchUrlContentTool = createTool({
  id: 'fetch-url-content',
  description: 'Fetches and extracts the main content from a given URL passed via link property from webSearchTool',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to fetch and extract content from'),
  }),
  outputSchema: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    text: z.string().optional(),
    author: z.string().optional(),
    published: z.string().optional(),
    url: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { url } = context;
    try {
      const result = await fetchAndExtract(url);
      if (!result) {
        return { error: 'Could not extract content.' };
      }
      return {
        title: result.title,
        content: result.content,
        author: result.author,
        published: result.published,
        url: result.url,
      };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },
});

function logDebug(message: string) {
  console.log(message);
  fs.appendFileSync('wow_gear_debug.log', message + '\n');
}

async function fetchAndExtract(url: string) {
  console.log('Fetching and extracting:', url);
  try {
    const result = await extract(url);

    if (!result) {
      console.log('Could not extract content from:', url);
      return;
    }

    console.log('Title:', result.title);
    console.log('Content:', result.content);

    return {
      title: result.title,
      content: result.content,
      author: result.author,
      published: result.published,
      url: result.url,
    };
  } catch (err) {
    console.error('Error fetching and extracting:', err);
  }
}

// USAGE NOTE:
// webSearchTool returns results with a 'link' property (the URL of the result).
// fetchUrlContentTool expects an input object with a 'url' property.
// To chain them, pass result.link as the url input:
//
//   const searchResults = await webSearchTool.execute({ query: 'OpenAI', limit: 3 });
//   for (const result of searchResults) {
//     const article = await fetchUrlContentTool.execute({ url: result.link });
//     // ...
//   }

export { 
  wowCharacterGearTool, 
  webSearchTool, 
  fetchUrlContentTool,
  dataFreshnessTool 
};


