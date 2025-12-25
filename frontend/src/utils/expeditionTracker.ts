import { NETWORK, PACKAGE_ID } from "../constants";

export type ExpeditionResultSummary = {
  success: boolean;
  foodGained: number;
  waterGained: number;
  scrapGained: number;
  itemsGained: number;
  damageTaken: number;
  blueprintDroppedCount: number;
};

export type TrackedExpedition = {
  npcId: string;
  npcName: string;
  ownerAddress: string;
  startedAtMs: number;
  endsAtMs: number;
  durationHours: number;
  notified: boolean;
  result?: ExpeditionResultSummary;
};

const storageKey = (ownerAddress: string) => `outpost.expeditions.v2.${NETWORK}.${PACKAGE_ID}.${ownerAddress}`;

export function loadTrackedExpeditions(ownerAddress: string): TrackedExpedition[] {
  try {
    const raw = localStorage.getItem(storageKey(ownerAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e) => e as TrackedExpedition)
      .filter((e) => !!e && typeof e.npcId === "string" && typeof e.endsAtMs === "number");
  } catch {
    return [];
  }
}

export function saveTrackedExpeditions(ownerAddress: string, expeditions: TrackedExpedition[]) {
  localStorage.setItem(storageKey(ownerAddress), JSON.stringify(expeditions));
}

export function upsertTrackedExpedition(ownerAddress: string, expedition: TrackedExpedition) {
  const list = loadTrackedExpeditions(ownerAddress);
  const idx = list.findIndex((e) => e.npcId === expedition.npcId);
  if (idx >= 0) list[idx] = expedition;
  else list.push(expedition);
  saveTrackedExpeditions(ownerAddress, list);
}

export function markExpeditionNotified(ownerAddress: string, npcId: string) {
  const list = loadTrackedExpeditions(ownerAddress);
  const idx = list.findIndex((e) => e.npcId === npcId);
  if (idx < 0) return;
  list[idx] = { ...list[idx], notified: true };
  saveTrackedExpeditions(ownerAddress, list);
}

export function removeTrackedExpedition(ownerAddress: string, npcId: string) {
  const list = loadTrackedExpeditions(ownerAddress).filter((e) => e.npcId !== npcId);
  saveTrackedExpeditions(ownerAddress, list);
}

export function clearAllExpeditions(ownerAddress: string) {
  localStorage.removeItem(storageKey(ownerAddress));
}

export function isNpcOnExpedition(ownerAddress: string, npcId: string, nowMs: number = Date.now()): boolean {
  return loadTrackedExpeditions(ownerAddress).some((e) => e.npcId === npcId && e.endsAtMs > nowMs);
}

export function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
