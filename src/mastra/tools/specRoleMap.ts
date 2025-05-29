// Shared mapping from spec ID to role for all WoW specs
export const SPEC_ID_TO_ROLE: Record<number, 'tank' | 'healing' | 'dps'> = {
  // Death Knight
  250: 'tank', 251: 'dps', 252: 'dps',
  // Demon Hunter
  577: 'dps', 581: 'tank',
  // Druid
  102: 'dps', 103: 'dps', 104: 'tank', 105: 'healing',
  // Evoker
  1467: 'dps', 1468: 'healing', 1473: 'dps',
  // Hunter
  253: 'dps', 254: 'dps', 255: 'dps',
  // Mage
  62: 'dps', 63: 'dps', 64: 'dps',
  // Monk
  268: 'tank', 269: 'dps', 270: 'healing',
  // Paladin
  65: 'healing', 66: 'tank', 70: 'dps',
  // Priest
  256: 'healing', 257: 'healing', 258: 'dps',
  // Rogue
  259: 'dps', 260: 'dps', 261: 'dps',
  // Shaman
  262: 'dps', 263: 'dps', 264: 'healing',
  // Warlock
  265: 'dps', 266: 'dps', 267: 'dps',
  // Warrior
  71: 'dps', 72: 'dps', 73: 'tank',
};

export function getRoleForSpecId(specId: number): 'tank' | 'healing' | 'dps' | undefined {
  return SPEC_ID_TO_ROLE[specId];
} 