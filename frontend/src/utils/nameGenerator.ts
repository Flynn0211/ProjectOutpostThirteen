export const PREFIXES = [
  "Iron", "Shadow", "Rust", "Dust", "Steel", "Grim", "Silent", "Mad", "Pale", "Dark",
  "Scrap", "Neon", "Cyber", "Void", "Ash", "Storm", "Rogue", "Ghost", "Dead", "Lone"
];

export const SUFFIXES = [
  "Walker", "Stalker", "Drifter", "Hunter", "Scavenger", "Runner", "Raider", "Survivor", "Wolf", "Eagle",
  "Rat", "Fox", "Hawk", "Blade", "Fist", "Eye", "Hand", "Heart", "Soul", "Mind"
];

export function generateRandomName(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}
