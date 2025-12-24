import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import { NPC } from "../types";
import { getNPCSpriteUrl } from "../utils/imageUtils";
import { NPC_STATUS, RARITY_NAMES } from "../constants";
import { PACKAGE_ID } from "../constants";

interface ExpeditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
}

export function ExpeditionModal({ isOpen, onClose, bunkerId }: ExpeditionModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !account) return;

    async function loadNPCs() {
      try {
        const npcObjects = await getOwnedObjects(
          account.address,
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
    if (!account || !selectedNpc) return;

    setLoading(true);
    try {
      signAndExecute(
        {
          transaction: {
            kind: "moveCall",
            data: {
              package: PACKAGE_ID,
              module: "expedition",
              function: "start_expedition",
              arguments: [selectedNpc, bunkerId, duration],
              typeArguments: [],
            },
          },
        },
        {
          onSuccess: () => {
            alert("Expedition started!");
            onClose();
          },
          onError: (error) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Start Expedition</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* NPC Selection */}
          <div>
            <label className="block text-white mb-2">Select NPC</label>
            {npcs.length === 0 ? (
              <div className="text-gray-400 text-center py-4">
                No available NPCs (must be IDLE)
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {npcs.map((npc) => (
                  <div
                    key={npc.id}
                    onClick={() => setSelectedNpc(npc.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedNpc === npc.id
                        ? "bg-blue-600 border-2 border-blue-400"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <div className="text-white text-sm">
                      <div className="font-bold truncate">{npc.name}</div>
                      <div className="text-xs text-gray-300">
                        {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]}
                      </div>
                      <div className="text-xs mt-1">
                        HP: {npc.current_hp}/{npc.max_hp}
                      </div>
                      <div className="text-xs">
                        Stamina: {npc.current_stamina}/{npc.max_stamina}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-white mb-2">Duration (hours)</label>
            <input
              type="number"
              min="1"
              max="24"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
            />
            <div className="text-gray-400 text-sm mt-1">
              Longer expeditions = higher risk but better rewards
            </div>
          </div>

          <button
            onClick={handleStartExpedition}
            disabled={loading || !selectedNpc}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {loading ? "Starting expedition..." : "Start Expedition"}
          </button>
        </div>
      </div>
    </div>
  );
}

