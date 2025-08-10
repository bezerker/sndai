import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wowCharacterGearTool } from '../../src/mastra/tools';

type FetchArgs = Parameters<typeof fetch>;

const mockToken = 'fake-token';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

function textResponse(text: string, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as Response;
}

describe('wowCharacterGearTool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches character, spec, and equipment and returns normalized output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args: FetchArgs) => {
      const url = String(args[0]);
      if (url.includes('/oauth/token')) {
        return jsonResponse({ access_token: mockToken });
      }
      if (url.includes('/profile/wow/character/') && !url.includes('/specializations') && !url.includes('/equipment')) {
        return jsonResponse({
          name: 'Bezvoker',
          realm: { name: 'Korgath' },
          level: 80,
          character_class: { name: 'Evoker' },
          race: { name: 'Dracthyr' },
          gender: { name: 'Female' },
          guild: { name: 'Test Guild' },
        });
      }
      if (url.includes('/specializations')) {
        return jsonResponse({
          active_specialization: { id: 1467, name: 'Devastation' },
          active_hero_talent_tree: { id: 1, name: 'Scalecommander' },
        });
      }
      if (url.includes('/data/wow/playable-specialization/')) {
        return jsonResponse({ role: { type: 'dps' } });
      }
      if (url.includes('/equipment')) {
        return jsonResponse({
          equipped_items: [
            { slot: { name: 'Head' }, name: 'Cowl of Tests', quality: { name: 'Epic' }, level: { value: 525 } },
          ],
        });
      }
      return textResponse('not found', false, 404);
    });

    const result = await wowCharacterGearTool.execute({ context: { characterName: 'bezvoker', serverName: 'korgath', region: 'us' } } as any);

    expect(fetchMock).toHaveBeenCalled();
    expect(result.name).toBe('Bezvoker');
    expect(result.server).toBe('Korgath');
    expect(result.spec).toBe('Devastation');
    expect(result.role).toBe('dps');
    expect(result.heroTalentTree).toEqual({ id: 1, name: 'Scalecommander' });
    expect(result.gear).toEqual([
      { slot: 'Head', name: 'Cowl of Tests', quality: 'Epic', itemLevel: 525 },
    ]);
  });

  it('falls back to static role mapping when playable-specialization API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args: FetchArgs) => {
      const url = String(args[0]);
      if (url.includes('/oauth/token')) return jsonResponse({ access_token: mockToken });
      if (url.includes('/profile/wow/character/') && !url.includes('/specializations') && !url.includes('/equipment'))
        return jsonResponse({ name: 'Bezvoker', realm: { name: 'Korgath' } });
      if (url.includes('/specializations')) return jsonResponse({ active_specialization: { id: 66, name: 'Protection' } });
      if (url.includes('/data/wow/playable-specialization/')) return textResponse('error', false, 500);
      if (url.includes('/equipment')) return jsonResponse({ equipped_items: [] });
      return textResponse('not found', false, 404);
    });

    const result = await wowCharacterGearTool.execute({ context: { characterName: 'bezvoker', serverName: 'korgath', region: 'us' } } as any);
    expect(result.role).toBe('tank');
  });
});
