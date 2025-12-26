import { useQuery } from "@tanstack/react-query";
import { getObject } from "../utils/sui";
import type { Bunker, NPC } from "../types";
import { queryKeys } from "./queryKeys";

const DEFAULT_STALE_TIME_MS = 10000;

export function useBunker(bunkerId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.bunker(bunkerId ?? ""),
    enabled: !!bunkerId,
    queryFn: async () => {
      if (!bunkerId) return null;
      const data = await getObject(bunkerId);
      return data as Bunker;
    },
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useNPC(npcId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.npc(npcId ?? ""),
    enabled: !!npcId,
    queryFn: async () => {
      if (!npcId) return null;
      const data = await getObject(npcId);
      return data as NPC;
    },
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}
