import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';

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


function logDebug(message: string) {
  console.log(message);
  fs.appendFileSync('wow_gear_debug.log', message + '\n');
}

export { wowCharacterGearTool };


