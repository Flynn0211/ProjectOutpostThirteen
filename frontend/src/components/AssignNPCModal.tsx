import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { getOwnedObjects, getObjectType, getObject } from "../utils/sui";
import type { NPC, Room } from "../types";
import { NPC_STATUS, RARITY_NAMES } from "../constants";
import { PACKAGE_ID } from "../constants";

interface AssignNPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  roomIndex: number;
  bunkerId: string;
  onSuccess: () => void;
}

export function AssignNPCModal({
  isOpen,
  onClose,
  room,
  roomIndex,
  bunkerId,
  onSuccess,
}: AssignNPCModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [powerSufficient, setPowerSufficient] = useState<boolean>(true);

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

    async function loadBunkerPower() {
      try {
        const bunker = await getObject(bunkerId);
        if (bunker) {
          const gen = Number(bunker.power_generation || 0);
          const con = Number(bunker.power_consumption || 0);
          setPowerSufficient(gen >= con);
        }
      } catch (error) {
        console.error("Error loading bunker power:", error);
      }
    }

    loadNPCs();
    loadBunkerPower();
  }, [isOpen, account]);

  const handleAssign = async () => {
    if (!account?.address || !selectedNpc) return;
    if (!powerSufficient) {
      alert("Insufficient power. Please ensure Generator output covers consumption.");
      return;
    }

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::npc::assign_to_room`,
        arguments: [
          tx.object(selectedNpc),
          tx.object(bunkerId),
          tx.pure(roomIndex, "u64"),
          tx.object("0x6"), // Clock
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            alert("NPC assigned to room!");
            onSuccess();
            onClose();
          },
          onError: (error: any) => {
            console.error("Assign error:", error);
            alert("Assign failed: " + error.message);
          },
        }
      );
    } catch (error: any) {
      console.error("Assign error:", error);
      alert("Assign failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        {/* Animated corner accents */}
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#5fffc0] rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#5fffc0] rounded-br-2xl" />
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer" />
        
        <div className="relative flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">Assign NPC</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        <div className="relative space-y-5">
          <div className="bg-gradient-to-r from-[#1a1f2e] to-[#0d1117] border-2 border-[#4deeac] p-4 rounded-xl shadow-[0_0_15px_rgba(77,238,172,0.3)]">
            <div className="text-white flex items-center gap-3">
              <span className="text-2xl">🏠</span>
              <div className="font-bold text-[#4deeac] text-lg">
                Room Capacity: <span className="text-white">{room.assigned_npcs}/{room.capacity}</span>
              </div>
            </div>
          </div>

          {npcs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-[#4deeac] text-xl font-bold">No available NPCs</div>
              <div className="text-gray-400 text-sm mt-2">(NPCs must be in IDLE status)</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-2">
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
                      <div className={`text-xs font-semibold ${selectedNpc === npc.id ? "text-[#0d1117]" : "text-[#4deeac]"}`}>
                        {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]}
                      </div>
                      <div className="text-xs mt-2 flex items-center gap-1">
                        <span>❤️</span> HP: {npc.current_hp}/{npc.max_hp}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAssign}
                disabled={loading || !selectedNpc || room.assigned_npcs >= room.capacity}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(77,238,172,0.6)] hover:shadow-[0_0_35px_rgba(77,238,172,0.8)] hover:scale-105 disabled:shadow-none transform"
              >
                {loading ? "Assigning..." : "✅ Assign NPC to Room"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

