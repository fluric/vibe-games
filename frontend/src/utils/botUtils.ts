import aiConfig from '../../../backend/src/game/aiConfig.json';

const typedConfig = aiConfig as Record<string, Record<string, { id: string }>>;

export const AI_BOT_IDS = Array.from(new Set([
  '00000000-0000-0000-0000-000000000000', // legacy
  ...Object.values(typedConfig).flatMap(gameBots => Object.values(gameBots).map(b => b.id))
]));

export function isBotId(id?: string | null): boolean {
  if (!id) return false;
  return AI_BOT_IDS.includes(id);
}
