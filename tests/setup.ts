import { vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';

// Set env for tests (no real secrets used)
beforeAll(() => {
  process.env.BLIZZARD_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID || 'test-client-id';
  process.env.BLIZZARD_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET || 'test-client-secret';
  process.env.MODEL_PROVIDER = process.env.MODEL_PROVIDER || 'openai';
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
  process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
  process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  // Discord adapter test env
  process.env.DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'test-discord-token';
  process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'test-client-id';

  // Prevent writing debug logs to the repository during tests
  vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {} as any);
});

afterAll(() => {
  vi.restoreAllMocks();
});
