import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import type { NPC } from "../types";
import { getNPCSpriteUrl } from "../utils/imageUtils";
import { RARITY_NAMES, NPC_STATUS } from "../constants";

interface NPCManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NPC_STATUS_NAMES = {
  [0]: "Idle",
  [1]: "On Mission",
  [2]: "Knocked",
  [3]: "Working",
};

export function NPCManagerModal({ isOpen, onClose }: NPCManagerModalProps) {
  const account = useCurrentAccount();
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NPC | null>(null);

  useEffect(() => {
    if (!isOpen || !account?.address) return;

    async function loadNPCs() {
      setLoading(true);
      try {
        const npcObjects = await getOwnedObjects(
          account!.address,
          getObjectType("npc", "NPC")
        );
        const cleaned = (npcObjects as NPC[]).filter((n) => !!n && !!(n as any).id);
        setNpcs(cleaned);
        if (!selectedNpc && cleaned.length > 0) {
          setSelectedNpc(cleaned[0]);
        }
      } catch (error) {
        console.error("Error loading NPCs:", error);
      } finally {
        setLoading(false);
      }
    }

    loadNPCs();
  }, [isOpen, account]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Manage NPCs</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-white text-center py-8">Loading NPCs...</div>
        ) : npcs.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No NPCs owned</div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* NPC List */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Your NPCs</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {npcs.map((npc) => (
                  <div
                    key={npc.id || Math.random()}
                    onClick={() => npc && setSelectedNpc(npc)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedNpc?.id === npc.id
                        ? "bg-blue-600 border-2 border-blue-400"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <div className="text-white">
                      <div className="font-bold">{npc.name}</div>
                      <div className="text-xs text-gray-300">
                        {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]} · Level {npc.level}
                      </div>
                      <div className="text-xs mt-1 text-gray-400">
                        Status: {NPC_STATUS_NAMES[npc.status as keyof typeof NPC_STATUS_NAMES] || "Unknown"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NPC Details */}
            {selectedNpc ? (
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Details</h3>
                <div className="bg-gray-700 rounded-lg p-4 space-y-4">
                  <div className="w-32 h-32 bg-gray-800 rounded-lg border border-gray-600 mx-auto">
                    <div
                      className="w-32 h-32 bg-contain bg-no-repeat bg-left"
                      style={{
                        backgroundImage: `url(${getNPCSpriteUrl(selectedNpc.rarity, selectedNpc.profession)})`,
                        backgroundPosition: "0px 0px", // Idle frame 0
                      }}
                    />
                  </div>
                  
                  <div className="text-white space-y-2">
                    <div className="text-xl font-bold">{selectedNpc.name}</div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Rarity:</span>
                        <span className="ml-2 font-bold">
                          {RARITY_NAMES[selectedNpc.rarity as keyof typeof RARITY_NAMES]}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Level:</span>
                        <span className="ml-2 font-bold">{selectedNpc.level}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <span className="ml-2 font-bold">
                          {NPC_STATUS_NAMES[selectedNpc.status as keyof typeof NPC_STATUS_NAMES] || "Unknown"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Profession:</span>
                        <span className="ml-2 font-bold">{selectedNpc.profession}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-600 pt-2">
                      <div className="text-sm font-bold text-gray-300 mb-2">Stats</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">HP:</span>
                          <span>{selectedNpc.current_hp}/{selectedNpc.max_hp}</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded h-2">
                          <div
                            className="bg-red-600 h-2 rounded"
                            style={{
                              width: `${(selectedNpc.current_hp / selectedNpc.max_hp) * 100}%`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between mt-2">
                          <span className="text-gray-400">Stamina:</span>
                          <span>{selectedNpc.current_stamina}/{selectedNpc.max_stamina}</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded h-2">
                          <div
                            className="bg-yellow-600 h-2 rounded"
                            style={{
                              width: `${(selectedNpc.current_stamina / selectedNpc.max_stamina) * 100}%`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between mt-2">
                          <span className="text-gray-400">Hunger:</span>
                          <span>{selectedNpc.hunger}/100</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded h-2">
                          <div
                            className="bg-orange-600 h-2 rounded"
                            style={{ width: `${selectedNpc.hunger}%` }}
                          />
                        </div>

                        <div className="flex justify-between mt-2">
                          <span className="text-gray-400">Thirst:</span>
                          <span>{selectedNpc.thirst}/100</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded h-2">
                          <div
                            className="bg-blue-600 h-2 rounded"
                            style={{ width: `${selectedNpc.thirst}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center bg-gray-700 rounded-lg p-8">
                <span className="text-gray-400">Select an NPC to view details</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
