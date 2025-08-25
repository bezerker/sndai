import type { Message } from 'discord.js';
import type { CoreMessage } from 'ai';
import { storage } from './storage';

type ScopeType = 'guild' | 'channel' | 'thread';

interface CharacterBinding {
  name: string;
  realm: string;
  region: string;
  class?: string;
  spec?: string;
  role?: string;
}

interface UserProfileMetadata {
  type: 'user';
  aliases?: string[];
  aliasesByGuild?: Record<string, string[]>;
  charactersByGuild?: Record<string, CharacterBinding[]>;
  blizzardBattleTag?: string;
  updatedAt?: string;
}

interface ScopeMemoryMetadata {
  type: ScopeType;
  rollingSummary?: string;
  topics?: string[];
  expiresAt?: string;
  updatedAt?: string;
}

const MINUTES = 60 * 1000;
const DEFAULT_TTL = {
  guild: Number(process.env.MEMORY_GUILD_TTL_MINUTES || 10080) * MINUTES, // 7 days
  channel: Number(process.env.MEMORY_CHANNEL_TTL_MINUTES || 240) * MINUTES, // 4 hours
  thread: Number(process.env.MEMORY_THREAD_TTL_MINUTES || 240) * MINUTES, // 4 hours
};

const MAX_SUMMARY_LENGTH = Number(process.env.MEMORY_SCOPE_SUMMARY_MAX_CHARS || 4000);

export function getUserResourceId(userId: string): string {
  return `discord:user:${userId}`;
}

function getGuildResourceId(guildId?: string | null): string | null {
  return guildId ? `discord:guild:${guildId}` : null;
}

function getChannelResourceId(channelId: string): string {
  return `discord:channel:${channelId}`;
}

function getPerUserThreadId(message: Message): string {
  const guildPart = message.guild?.id || 'dm';
  const channelPart = message.channel.id;
  const userPart = message.author.id;
  return `discord:${guildPart}:${channelPart}:u:${userPart}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

async function loadResource(resourceId: string): Promise<null | { workingMemory?: string | null; metadata?: any }>{
  const res = await storage.getResourceById({ resourceId }).catch(() => null);
  if (!res) return null;
  return { workingMemory: res.workingMemory as string | null, metadata: res.metadata };
}

async function saveResource(resourceId: string, { workingMemory, metadata }: { workingMemory?: string; metadata?: any }) {
  await storage.updateResource({ resourceId, ...(workingMemory !== undefined ? { workingMemory } : {}), ...(metadata ? { metadata } : {}) });
}

function dedupe<T>(arr: T[] | undefined, key?: (t: T) => string): T[] | undefined {
  if (!arr) return undefined;
  if (!key) return Array.from(new Set(arr as unknown as any)) as unknown as T[];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function sanitizeText(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function appendSummary(prev: string | undefined, userText: string, assistantText?: string): string {
  const combined = [prev || '', `User: ${userText}`.trim(), assistantText ? `Assistant: ${assistantText}` : '']
    .filter(Boolean)
    .join('\n');
  // collapse whitespace and cap length
  const collapsed = combined.replace(/\n{3,}/g, '\n\n');
  if (collapsed.length <= MAX_SUMMARY_LENGTH) return collapsed;
  return collapsed.slice(collapsed.length - MAX_SUMMARY_LENGTH);
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const add = (t: string) => {
    if (!topics.includes(t)) topics.push(t);
  };
  const lower = text.toLowerCase();
  const classes = [
    'rogue','mage','warrior','hunter','priest','warlock','shaman','druid','paladin','monk','demon hunter','evoker','death knight'
  ];
  for (const c of classes) if (lower.includes(c)) add(c);
  if (/(mythic\+|m\+)/i.test(text)) add('mythic+');
  if (/\braid(s)?\b/i.test(text)) add('raid');
  if (/\bpvp\b/i.test(text)) add('pvp');
  if (/\bbis\b/i.test(text)) add('bis');
  return topics;
}

export async function getUserProfile(userId: string, guildId?: string | null): Promise<{ aliases: string[]; characters: CharacterBinding[]; battleTag?: string }>{
  const userResourceId = getUserResourceId(userId);
  const res = await loadResource(userResourceId);
  const meta = (res?.metadata || {}) as UserProfileMetadata;
  const aliasesGlobal = meta.aliases || [];
  const aliasesGuild = guildId ? meta.aliasesByGuild?.[guildId] || [] : [];
  const charactersGuild = guildId ? meta.charactersByGuild?.[guildId] || [] : [];
  return {
    aliases: dedupe([...(aliasesGlobal || []), ...(aliasesGuild || [])]) || [],
    characters: dedupe(charactersGuild, c => `${c.name}|${c.realm}|${c.region}`) || [],
    battleTag: meta.blizzardBattleTag,
  };
}

export async function addUserAlias(userId: string, alias: string, guildId?: string | null): Promise<void> {
  const userResourceId = getUserResourceId(userId);
  const res = (await loadResource(userResourceId)) || {};
  const meta = (res.metadata || { type: 'user' }) as UserProfileMetadata;
  meta.type = 'user';
  meta.aliases = dedupe([...(meta.aliases || []), alias]) || [];
  if (guildId) {
    meta.aliasesByGuild = meta.aliasesByGuild || {};
    const existing = meta.aliasesByGuild[guildId] || [];
    meta.aliasesByGuild[guildId] = dedupe([...(existing || []), alias]) || [];
  }
  meta.updatedAt = nowIso();
  await saveResource(userResourceId, { metadata: meta });
}

export async function bindCharacterToUser(userId: string, guildId: string, character: CharacterBinding): Promise<void> {
  const userResourceId = getUserResourceId(userId);
  const res = (await loadResource(userResourceId)) || {};
  const meta = (res.metadata || { type: 'user' }) as UserProfileMetadata;
  meta.type = 'user';
  meta.charactersByGuild = meta.charactersByGuild || {};
  const list = meta.charactersByGuild[guildId] || [];
  const next = dedupe([...(list || []), character], c => `${c.name}|${c.realm}|${c.region}`) || [];
  meta.charactersByGuild[guildId] = next;
  meta.updatedAt = nowIso();
  await saveResource(userResourceId, { metadata: meta });
}

async function loadScopeMemory(scope: ScopeType, scopeId: string): Promise<ScopeMemoryMetadata | null> {
  const rid = scope === 'guild' ? getGuildResourceId(scopeId) : scope === 'channel' ? getChannelResourceId(scopeId) : `discord:thread:${scopeId}`;
  if (!rid) return null;
  const res = await loadResource(rid);
  const meta = (res?.metadata || null) as ScopeMemoryMetadata | null;
  if (!meta || meta.type !== scope) return null;
  if (isExpired(meta.expiresAt)) return null;
  return meta;
}

async function saveScopeMemory(scope: ScopeType, scopeId: string, updater: (prev: ScopeMemoryMetadata | null) => ScopeMemoryMetadata) {
  const rid = scope === 'guild' ? getGuildResourceId(scopeId) : scope === 'channel' ? getChannelResourceId(scopeId) : `discord:thread:${scopeId}`;
  if (!rid) return;
  const prev = await loadScopeMemory(scope, scopeId);
  const next = updater(prev);
  next.type = scope;
  next.updatedAt = nowIso();
  await saveResource(rid, { metadata: next });
}

export async function updateScopeRollingMemory(opts: {
  scope: ScopeType;
  scopeId: string;
  userText: string;
  assistantText?: string;
}): Promise<void> {
  const ttl = DEFAULT_TTL[opts.scope];
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  const topics = extractTopics(`${opts.userText}\n${opts.assistantText || ''}`);
  await saveScopeMemory(opts.scope, opts.scopeId, prev => ({
    type: opts.scope,
    rollingSummary: appendSummary(prev?.rollingSummary, opts.userText, opts.assistantText),
    topics: dedupe([...(prev?.topics || []), ...topics]) || [],
    expiresAt,
    updatedAt: nowIso(),
  }));
}

export async function getMergedScopeContext(message: Message): Promise<{ guild?: ScopeMemoryMetadata | null; channel?: ScopeMemoryMetadata | null; thread?: ScopeMemoryMetadata | null; }> {
  const guildMem = message.guild?.id ? await loadScopeMemory('guild', message.guild.id) : null;
  const channelMem = await loadScopeMemory('channel', message.channel.id);
  let threadMem: ScopeMemoryMetadata | null = null;
  const chAny = message.channel as any;
  try {
    const isThread = typeof chAny?.isThread === 'function' ? chAny.isThread() : false;
    if (isThread) {
      threadMem = await loadScopeMemory('thread', message.channel.id);
    }
  } catch {
    // ignore thread detection errors
  }
  return { guild: guildMem, channel: channelMem, thread: threadMem };
}

function buildSystemContextText(params: {
  user: { aliases: string[]; characters: CharacterBinding[]; battleTag?: string };
  guild?: ScopeMemoryMetadata | null;
  channel?: ScopeMemoryMetadata | null;
  thread?: ScopeMemoryMetadata | null;
}): string | null {
  const lines: string[] = [];
  lines.push('[Discord Layered Memory Context]');
  if (params.user.aliases.length || params.user.characters.length || params.user.battleTag) {
    lines.push('User Profile:');
    if (params.user.battleTag) lines.push(`- BattleTag: ${params.user.battleTag}`);
    if (params.user.aliases.length) lines.push(`- Aliases: ${params.user.aliases.join(', ')}`);
    if (params.user.characters.length) {
      const chars = params.user.characters.map(c => `${c.name} (${c.class || ''} ${c.spec || ''}) - ${c.region}-${c.realm}`.trim());
      lines.push(`- WoW Characters (this guild): ${chars.join('; ')}`);
    }
  }
  if (params.guild?.rollingSummary || (params.guild?.topics && params.guild.topics.length)) {
    lines.push('Guild Context:');
    if (params.guild.rollingSummary) lines.push(params.guild.rollingSummary);
    if (params.guild.topics?.length) lines.push(`Topics: ${params.guild.topics.join(', ')}`);
  }
  if (params.channel?.rollingSummary || (params.channel?.topics && params.channel.topics.length)) {
    lines.push('Channel Context:');
    if (params.channel.rollingSummary) lines.push(params.channel.rollingSummary);
    if (params.channel.topics?.length) lines.push(`Topics: ${params.channel.topics.join(', ')}`);
  }
  if (params.thread?.rollingSummary || (params.thread?.topics && params.thread.topics.length)) {
    lines.push('Thread Context:');
    if (params.thread.rollingSummary) lines.push(params.thread.rollingSummary);
    if (params.thread.topics?.length) lines.push(`Topics: ${params.thread.topics.join(', ')}`);
  }
  const text = lines.join('\n').trim();
  return text.length ? text : null;
}

export async function prepareLayeredMemory(message: Message): Promise<{ memory: { resource: string; thread: string }; context: CoreMessage[] }> {
  const userResource = getUserResourceId(message.author.id);
  const threadId = getPerUserThreadId(message);
  const user = await getUserProfile(message.author.id, message.guild?.id);
  const scope = await getMergedScopeContext(message);
  const systemText = buildSystemContextText({ user, guild: scope.guild, channel: scope.channel, thread: scope.thread });
  const context: CoreMessage[] = systemText ? [{ role: 'system', content: systemText }] : [];

  // If this message is a reply, include the referenced message content as immediate shared context
  try {
    const refId = (message as any)?.reference?.messageId as string | undefined;
    if (refId && typeof message.fetchReference === 'function') {
      const referenced = await (message as any).fetchReference();
      if (referenced && referenced.content) {
        const isFromBot = referenced.author?.id && message.client?.user?.id && referenced.author.id === message.client.user.id;
        const role: 'user' | 'assistant' = isFromBot ? 'assistant' : 'user';
        const refText = sanitizeText(String(referenced.content));
        if (refText) {
          context.push({ role, content: `[Reply Context] ${refText}` });
        }
      }
    }
  } catch {
    // ignore reply context errors
  }
  return {
    memory: { resource: userResource, thread: threadId },
    context,
  };
}

export async function rememberAfterResponse(message: Message, userTextRaw: string, assistantTextRaw: string): Promise<void> {
  const userText = sanitizeText(userTextRaw);
  const assistantText = sanitizeText(assistantTextRaw);
  const guildId = message.guild?.id || null;
  if (guildId) {
    await updateScopeRollingMemory({ scope: 'guild', scopeId: guildId, userText, assistantText });
  }
  await updateScopeRollingMemory({ scope: 'channel', scopeId: message.channel.id, userText, assistantText });
  const chAny = message.channel as any;
  try {
    const isThread = typeof chAny?.isThread === 'function' ? chAny.isThread() : false;
    if (isThread) {
      await updateScopeRollingMemory({ scope: 'thread', scopeId: message.channel.id, userText, assistantText });
    }
  } catch {
    // ignore
  }
}


