import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
  }[];
}
interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

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

const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});

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

const getWeather = async (location: string) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as WeatherResponse;

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
  };
};

const getWoWCharacterGear = async (characterName: string, serverName: string, region: string) => {
  try {
    // Note: You'll need to set up Blizzard API credentials
    const clientId = process.env.BLIZZARD_CLIENT_ID;
    const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Blizzard API credentials not configured');
      throw new Error('Blizzard API credentials not configured');
    }

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

    console.log('Fetching OAuth token...');
    // Get OAuth token
    const tokenResponse = await fetch(`https://${region}.battle.net/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
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

      // If we get a 404, try with the game data API
      if (characterResponse.status === 404) {
        console.log('Character not found in profile API, trying game data API...');
        const gameDataUrl = `https://${region}.api.blizzard.com/data/wow/character/${normalizedServerName}/${normalizedCharacterName}?namespace=profile-${region}&locale=en_US`;
        console.log('Attempting game data lookup:', gameDataUrl.replace(/access_token=[^&]*/, 'access_token=REDACTED'));

        const gameDataResponse = await fetch(gameDataUrl, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });

        if (!gameDataResponse.ok) {
          const gameDataErrorText = await gameDataResponse.text();
          console.error('Failed to fetch game data:', gameDataErrorText);
          throw new Error(`Character '${characterName}' not found on server '${serverName}'. Please verify the character name and server name are correct.`);
        }

        const characterData = await gameDataResponse.json() as WoWCharacterResponse;
        console.log('Successfully fetched character data from game data API');

        return {
          name: characterData.name,
          server: characterData.realm.name,
          level: characterData.level,
          class: characterData.character_class.name,
          race: characterData.race.name,
          gender: characterData.gender.name,
          gear: characterData.equipped_items.map(item => ({
            slot: item.slot.name,
            name: item.item.name,
            quality: item.item.quality.name,
            itemLevel: item.item.level,
          })),
        };
      }

      throw new Error(`Failed to fetch character data: ${characterResponse.statusText}\n${errorText}`);
    }

    const characterData = await characterResponse.json() as WoWCharacterResponse;
    console.log('Successfully fetched character data from profile API');

    return {
      name: characterData.name,
      server: characterData.realm.name,
      level: characterData.level,
      class: characterData.character_class.name,
      race: characterData.race.name,
      gender: characterData.gender.name,
      gear: characterData.equipped_items.map(item => ({
        slot: item.slot.name,
        name: item.item.name,
        quality: item.item.quality.name,
        itemLevel: item.item.level,
      })),
    };
  } catch (error) {
    console.error('Error in getWoWCharacterGear:', error);
    throw error;
  }
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return conditions[code] || 'Unknown';
}

export { weatherTool, wowCharacterGearTool };


