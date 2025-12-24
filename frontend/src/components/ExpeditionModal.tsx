import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { getOwnedObjects, getObjectType, getObject } from "../utils/sui";
import type { NPC } from "../types";
import { NPC_STATUS, RARITY_NAMES } from "../constants";
import { PACKAGE_ID } from "../constants";

interface ExpeditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
}

export function ExpeditionModal({ isOpen, onClose, bunkerId }: ExpeditionModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);
  const selected = npcs.find((n) => n.id === selectedNpc) || null;
  const staminaCost = 20 + (duration * 5);
  const canStart = !!selected && selected.hunger >= 20 && selected.thirst >= 20 && selected.current_stamina >= staminaCost;

  useEffect(() => {
    if (!isOpen || !account?.address) return;

    async function loadNPCs() {
      try {
        const npcObjects = await getOwnedObjects(
          account!.address,
          getObjectType("npc", "NPC")
        );
        // Filter only IDLE NPCs
        const idleNPCs = npcObjects.filter(
          (npc: any) => npc.status === NPC_STATUS.IDLE
        ) as NPC[];
        setNpcs(idleNPCs);
      } catch (error) {
        console.error("Error loading NPCs:", error);
      }
    }

    loadNPCs();
  }, [isOpen, account]);

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
          onSuccess: () => {
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
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
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

        <div className="space-y-4">
          {/* NPC Selection */}
          <div>
            <label className="block text-[#4deeac] font-bold mb-2 uppercase text-sm tracking-wider">Select NPC</label>
            {npcs.length === 0 ? (
              <div className="text-gray-400 text-center py-4">
                No available NPCs (must be IDLE)
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {npcs.map((npc) => (
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
              Requires: Hunger ≥ 20, Thirst ≥ 20, Stamina ≥ {staminaCost}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

