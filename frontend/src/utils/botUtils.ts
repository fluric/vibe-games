export const AI_BOT_IDS = [
  '00000000-0000-0000-0000-000000000000', // legacy
  '00000000-0000-0000-0000-000000000001', // Random Randy (Easy)
  '00000000-0000-0000-0000-000000000002', // Aggressive Archie (Medium)
  '00000000-0000-0000-0000-000000000003', // Defensive Debbie (Medium)
  '00000000-0000-0000-0000-000000000004', // Mobile Monty (Medium)
  '00000000-0000-0000-0000-000000000005', // Tactical Toby (Hard)
  '00000000-0000-0000-0000-000000000006', // Grandmaster Garry (Expert)
  '00000000-0000-0000-0000-000000000007', // Champion Magnus (Legendary)
  '00000000-0000-0000-0000-000000000008', // Perfect Oracle (Grandmaster)
  '00000000-0000-0000-0000-000000000009', // Random Randy (C4 Easy)
  '00000000-0000-0000-0000-000000000010', // Aggressive Archie (C4 Medium)
  '00000000-0000-0000-0000-000000000011', // Defensive Debbie (C4 Medium)
  '00000000-0000-0000-0000-000000000012', // Mobile Monty (C4 Medium)
  '00000000-0000-0000-0000-000000000013', // Tactical Toby (C4 Hard)
  '00000000-0000-0000-0000-000000000014', // Grandmaster Garry (C4 Expert)
  '00000000-0000-0000-0000-000000000015', // Champion Magnus (C4 Legendary)
  '00000000-0000-0000-0000-000000000016', // Perfect Oracle (C4 Grandmaster)
  '00000000-0000-0000-0000-000000000017', // Cowardly Connie (Easy)
  '00000000-0000-0000-0000-000000000018', // Greedy Gordon (Easy)
  '00000000-0000-0000-0000-000000000019', // Arthur the Aggressive (Easy)
  '00000000-0000-0000-0000-000000000020', // Cowardly Connie (C4 Easy)
  '00000000-0000-0000-0000-000000000021', // Greedy Gordon (C4 Easy)
  '00000000-0000-0000-0000-000000000022', // Arthur the Aggressive (C4 Easy)
  '00000000-0000-0000-0000-000000000030', // Random Randy (HG Easy)
  '00000000-0000-0000-0000-000000000031', // Aggressive Archie (HG Medium)
  '00000000-0000-0000-0000-000000000032', // Tactical Toby (HG Hard)
  '00000000-0000-0000-0000-000000000040', // Neural Novice (C4 RL)
  '00000000-0000-0000-0000-000000000041', // Neural Scout (C4 RL)
  '00000000-0000-0000-0000-000000000042', // Neural Strategist (C4 RL)
  '00000000-0000-0000-0000-000000000043', // Neural Master (C4 RL)
];

export function isBotId(id?: string | null): boolean {
  if (!id) return false;
  return AI_BOT_IDS.includes(id);
}
