import { useMemo, useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { getObject, suiClient } from "../utils/sui";
import type { NPC } from "../types";
import { NPC_STATUS, RARITY_NAMES } from "../constants";
import { PACKAGE_ID } from "../constants";
import { useOwnedNpcsEnabled } from "../query/ownedQueries";
import { useGameStore } from "../state/gameStore";
import { postTxRefresh } from "../utils/postTxRefresh";
import {
  formatRemaining,
  isNpcOnExpedition,
  loadTrackedExpeditions,
  upsertTrackedExpedition,
  clearAllExpeditions,
  type ExpeditionResultSummary,
} from "../utils/expeditionTracker";

interface ExpeditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
}

export function ExpeditionModal({ isOpen, onClose, bunkerId }: ExpeditionModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const queryClient = useQueryClient();
  const devCheatsUnlocked = useGameStore((s) => s.devCheatsUnlocked);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const ownerAddress = account?.address ?? "";

  const npcsQuery = useOwnedNpcsEnabled(ownerAddress, isOpen);
  const npcs = (npcsQuery.data ?? []) as NPC[];
  const selected = npcs.find((n) => n.id === selectedNpc) || null;
  const staminaCost = 20 + duration * 5;

  // Match on-chain readiness (npc::is_ready_for_expedition + expedition stamina cost)
  const canStart =
    !!selected &&
    selected.status === NPC_STATUS.IDLE &&
    selected.current_hp > 20 &&
    selected.current_stamina > 30 &&
    selected.hunger > 20 &&
    selected.thirst > 20 &&
    selected.current_stamina >= staminaCost;

  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !ownerAddress) return;

    // Default selection: first available idle NPC not currently on expedition.
    const firstAvailable = npcs.find(
      (n) => n.status === NPC_STATUS.IDLE && !isNpcOnExpedition(ownerAddress, n.id)
    );

    setSelectedNpc((prev) => {
      if (prev && npcs.some((n) => n.id === prev)) return prev;
      return firstAvailable?.id ?? null;
    });
  }, [isOpen, ownerAddress, npcs]);

  const trackedActive = useMemo(() => {
    if (!ownerAddress) return [];
    return loadTrackedExpeditions(ownerAddress)
      .filter((e) => e.endsAtMs > nowMs)
      .sort((a, b) => a.endsAtMs - b.endsAtMs);
  }, [ownerAddress, nowMs]);

  const availableNpcs = useMemo(() => {
    if (!ownerAddress) return [];
    return npcs.filter((n) => n.status === NPC_STATUS.IDLE && !isNpcOnExpedition(ownerAddress, n.id, nowMs));
  }, [npcs, ownerAddress, nowMs]);

  const parseExpeditionEvents = (events: any[] | undefined): ExpeditionResultSummary | undefined => {
    if (!events || !Array.isArray(events)) return undefined;

    const resultEvt = events.find((e) => typeof e?.type === "string" && /::utils::ExpeditionResultEvent$/.test(e.type));
    const parsed = resultEvt?.parsedJson ?? resultEvt?.parsed_json;
    const toNum = (v: any) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0);

    const blueprintDroppedCount = events.filter(
      (e) => typeof e?.type === "string" && /::utils::BlueprintDroppedEvent$/.test(e.type)
    ).length;

    if (!parsed) {
      // Still return blueprint count if it exists.
      if (blueprintDroppedCount > 0) {
        return {
          success: true,
          foodGained: 0,
          waterGained: 0,
          scrapGained: 0,
          itemsGained: 0,
          damageTaken: 0,
          blueprintDroppedCount,
        };
      }
      return undefined;
    }

    return {
      success: !!parsed.success,
      foodGained: toNum(parsed.food_gained ?? parsed.foodGained),
      waterGained: toNum(parsed.water_gained ?? parsed.waterGained),
      scrapGained: toNum(parsed.scrap_gained ?? parsed.scrapGained),
      itemsGained: toNum(parsed.items_gained ?? parsed.itemsGained),
      damageTaken: toNum(parsed.damage_taken ?? parsed.damageTaken),
      blueprintDroppedCount,
    };
  };

  const handleStartExpedition = async () => {
    if (!account?.address || !selectedNpc || !bunkerId) {
      alert("Missing NPC or bunker. Please select an NPC and ensure you have a bunker.");
      return;
    }

    const npcId = String(selectedNpc).trim();
    const bunkerObjectId = String(bunkerId).trim();

    // Defensive validation to avoid passing undefined/invalid object args to tx.object(...)
    const isLikelyObjectId = (v: string) => /^0x[0-9a-fA-F]{1,64}$/.test(v);
    if (!isLikelyObjectId(npcId) || !isLikelyObjectId(bunkerObjectId)) {
      alert("Invalid object id. Please refresh and try again.");
      return;
    }

    // Ensure objects are fetchable before building tx (prevents ImmOrOwned undefined issues)
    const [npcObj, bunkerObj] = await Promise.all([
      getObject(npcId),
      getObject(bunkerObjectId),
    ]);
    if (!npcObj) {
      alert("Selected NPC object not found (or not readable). Please refresh and try again.");
      return;
    }
    if (!bunkerObj) {
      alert("Bunker object not found (or not readable). Please refresh and try again.");
      return;
    }

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::expedition::start_expedition`,
        arguments: [
          tx.object(npcId),
          tx.object(bunkerObjectId),
          tx.pure(duration, "u64"),
          tx.object("0x6"), // Clock object
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: async (result: any) => {
            // Expedition on-chain executes immediately, but UI now tracks a timer client-side.
            const endsAtMs = Date.now() + duration * 60 * 60 * 1000;
            const npcName = selected?.name ?? "NPC";

            // dapp-kit responses may omit events depending on options.
            // If missing, fetch the transaction block with events from the fullnode.
            let events: any[] | undefined = (result as any)?.events;
            try {
              if (!events || !Array.isArray(events)) {
                const digest = (result as any)?.digest;
                if (typeof digest === "string" && digest.length > 0) {
                  const txb = await suiClient.getTransactionBlock({
                    digest,
                    options: {
                      showEvents: true,
                    },
                  });
                  events = (txb as any)?.events;
                }
              }
            } catch (e) {
              console.warn("Failed to fetch tx events for expedition:", e);
            }

            const summary = parseExpeditionEvents(events);

            upsertTrackedExpedition(account.address, {
              npcId,
              npcName,
              ownerAddress: account.address,
              startedAtMs: Date.now(),
              endsAtMs,
              durationHours: duration,
              notified: false,
              result: summary,
            });

            if (ownerAddress) {
              postTxRefresh(queryClient, ownerAddress);
              window.setTimeout(() => postTxRefresh(queryClient, ownerAddress), 1200);
            }

            alert("Expedition started!");
            onClose();
          },
          onError: (error: any) => {
            console.error("Expedition error:", error);
            alert("Expedition failed: " + error.message);
          },
        }
      );
    } catch (error: any) {
      console.error("Expedition error:", error);
      alert("Expedition failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto overflow-x-hidden shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#5fffc0] rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#5fffc0] rounded-br-2xl" />

        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer" />

        <div className="relative flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">Start Expedition</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Active expeditions */}
          <div className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[#4deeac] font-bold uppercase text-sm tracking-wider">Active Expeditions</div>
                <div className="text-xs text-white/70">NPCs currently exploring and time remaining</div>
              </div>
              <div className="text-xs text-white/70">{trackedActive.length} active</div>
            </div>

            {devCheatsUnlocked && trackedActive.length > 0 && (
              <div className="flex justify-end mt-2">
                <button
                   onClick={() => {
                     if (account?.address) {
                        clearAllExpeditions(account.address);
                        setNowMs(Date.now()); // Trigger re-render
                        alert("Forced all expeditions to finish immediately.");
                     }
                   }}
                   className="text-[10px] text-red-400 hover:text-red-300 underline"
                >
                  Instant Finish All
                </button>
              </div>
            )}

            {trackedActive.length === 0 ? (
              <div className="text-white/60 text-sm mt-3">No NPCs on expedition.</div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {trackedActive.map((e) => (
                  <div
                    key={e.npcId}
                    className="bg-[#0d1117] border border-[#4deeac] rounded-lg p-3"
                  >
                    <div className="text-white font-bold truncate">{e.npcName}</div>
                    <div className="text-xs text-white/70 mt-1">
                      Time left: {formatRemaining(e.endsAtMs - nowMs)}
                    </div>
                    <div className="text-xs text-white/60 mt-1">Duration: {e.durationHours}h</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NPC Selection */}
          <div>
            <label className="block text-[#4deeac] font-bold mb-2 uppercase text-sm tracking-wider">Select NPC</label>
            {npcsQuery.isLoading ? (
              <div className="text-gray-400 text-center py-4">Loading NPCs...</div>
            ) : npcsQuery.error ? (
              <div className="text-red-300 text-center py-4">Failed to load NPCs: {String((npcsQuery.error as any)?.message ?? npcsQuery.error)}</div>
            ) : availableNpcs.length === 0 ? (
              <div className="text-gray-400 text-center py-4">
                No available NPCs (must be IDLE and not already on expedition)
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto overflow-x-hidden">
                {availableNpcs.map((npc) => (
                  <div
                    key={npc.id}
                    onClick={() => setSelectedNpc(npc.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 transform hover:scale-105 ${
                      selectedNpc === npc.id
                        ? "bg-gradient-to-br from-[#4deeac] to-[#3dd69a] border-[#5fffc0] text-[#0d1117] shadow-[0_0_20px_rgba(77,238,172,0.8)] scale-105"
                        : "bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] hover:from-[#2a3447] hover:to-[#1a1f2e] border-[#4deeac] text-white hover:shadow-[0_0_15px_rgba(77,238,172,0.4)]"
                    }`}
                  >
                    <div className="text-sm">
                      <div className="font-bold truncate text-base mb-1">{npc.name}</div>
                      <div className="text-xs text-[#4deeac] font-semibold">
                        {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]}
                      </div>
                      <div className="text-xs mt-2 flex items-center gap-1"><span>❤️</span> HP: {npc.current_hp}/{npc.max_hp}</div>
                      <div className="text-xs mt-1 flex items-center gap-1"><span>⚡</span> Stamina: {npc.current_stamina}/{npc.max_stamina}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-[#4deeac] font-bold mb-2 uppercase text-sm tracking-wider">Duration (hours)</label>
            <input
              type="number"
              min="1"
              max="24"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
              className="w-full px-5 py-3 bg-[#1a1f2e] text-white border-2 border-[#4deeac] rounded-xl focus:outline-none focus:border-[#5fffc0] focus:shadow-[0_0_20px_rgba(77,238,172,0.5)] transition-all duration-200"
            />
            <div className="text-white/70 text-sm mt-1">
              Longer expeditions = higher risk but better rewards
            </div>
          </div>

          <button
            onClick={handleStartExpedition}
            disabled={loading || !canStart}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(77,238,172,0.6)] hover:shadow-[0_0_35px_rgba(77,238,172,0.8)] hover:scale-105 disabled:shadow-none transform"
          >
            {loading ? "Starting expedition..." : "🚀 Start Expedition"}
          </button>
          {selected && !canStart && (
            <div className="mt-2 text-xs text-red-300">
              Requires: Status=IDLE, HP &gt; 20, Hunger &gt; 20, Thirst &gt; 20, Stamina ≥ {staminaCost}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

