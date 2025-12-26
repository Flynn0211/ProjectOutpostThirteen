import { useQuery } from "@tanstack/react-query";
import { getObjectType, getOwnedObjectsStrict } from "../utils/sui";
import type { Blueprint, Bunker, Item, NPC } from "../types";
import { queryKeys } from "./queryKeys";

const DEFAULT_REFETCH_INTERVAL_MS = import.meta.env.DEV ? 20000 : 10000;
const DEFAULT_STALE_TIME_MS = import.meta.env.DEV ? 15000 : 8000;

function isRateLimitError(error: unknown): boolean {
  const anyErr = error as any;
  const status = anyErr?.status ?? anyErr?.response?.status;
  if (status === 429) return true;
  const msg = String(anyErr?.message ?? "");
  return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("Unexpected status code: 429");
}

function retryPolicy(failureCount: number, error: unknown): boolean {
  if (isRateLimitError(error)) return failureCount < 1;
  return failureCount < 2;
}

function retryDelayMs(failureCount: number, error: unknown): number {
  const base = isRateLimitError(error) ? 2000 : 600;
  const delay = Math.min(base * 2 ** failureCount, 30000);
  const jitter = Math.floor(Math.random() * 250);
  return delay + jitter;
}

export function useOwnedBunkers(ownerAddress: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.bunkers(ownerAddress),
    enabled: !!ownerAddress,
    queryFn: async () => {
      const objs = await getOwnedObjectsStrict(ownerAddress, getObjectType("bunker", "Bunker"));
      return (objs as Bunker[]).filter((b) => !!b && !!(b as any).id);
    },
    refetchInterval: options?.refetchInterval ?? DEFAULT_REFETCH_INTERVAL_MS,
    staleTime: DEFAULT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: retryPolicy,
    retryDelay: retryDelayMs,
  });
}

export function useOwnedNpcs(ownerAddress: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.npcs(ownerAddress),
    enabled: !!ownerAddress,
    queryFn: async () => {
      const objs = await getOwnedObjectsStrict(ownerAddress, getObjectType("npc", "NPC"));
      return (objs as NPC[]).filter((n) => !!n && !!(n as any).id);
    },
    refetchInterval: options?.refetchInterval ?? DEFAULT_REFETCH_INTERVAL_MS,
    staleTime: DEFAULT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: retryPolicy,
    retryDelay: retryDelayMs,
  });
}

// Variant for modals: lets callers control `enabled` to avoid background polling while closed.
export function useOwnedNpcsEnabled(ownerAddress: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.npcs(ownerAddress),
    enabled: enabled && !!ownerAddress,
    queryFn: async () => {
      const objs = await getOwnedObjectsStrict(ownerAddress, getObjectType("npc", "NPC"));
      return (objs as NPC[]).filter((n) => !!n && !!(n as any).id);
    },
    refetchInterval: DEFAULT_REFETCH_INTERVAL_MS,
    staleTime: DEFAULT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: retryPolicy,
    retryDelay: retryDelayMs,
  });
}

export function useOwnedItems(ownerAddress: string) {
  return useQuery({
    queryKey: queryKeys.items(ownerAddress),
    enabled: !!ownerAddress,
    queryFn: async () => {
      const objs = await getOwnedObjectsStrict(ownerAddress, getObjectType("item", "Item"));
      return (objs as Item[]).filter((i) => !!i && !!(i as any).id);
    },
    refetchInterval: DEFAULT_REFETCH_INTERVAL_MS,
    staleTime: DEFAULT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: retryPolicy,
    retryDelay: retryDelayMs,
  });
}

export function useOwnedBlueprints(ownerAddress: string) {
  return useQuery({
    queryKey: queryKeys.blueprints(ownerAddress),
    enabled: !!ownerAddress,
    queryFn: async () => {
      const objs = await getOwnedObjectsStrict(ownerAddress, getObjectType("crafting", "Blueprint"));
      return (objs as Blueprint[]).filter((b) => !!b && !!(b as any).id);
    },
    refetchInterval: DEFAULT_REFETCH_INTERVAL_MS,
    staleTime: DEFAULT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: retryPolicy,
    retryDelay: retryDelayMs,
  });
}
