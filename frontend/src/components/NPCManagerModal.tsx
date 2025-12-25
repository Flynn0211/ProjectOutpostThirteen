import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import type { Item, NPC, Bunker } from "../types";
import { getNPCSpriteUrl } from "../utils/imageUtils";
import { SpriteSheet } from "./SpriteSheet";
import { ITEM_TYPES, NPC_STATUS, PACKAGE_ID, RARITY_NAMES, NPC_PROFESSION_NAMES } from "../constants";

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
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NPC | null>(null);
  const [bunker, setBunker] = useState<Bunker | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionLoadingItemId, setActionLoadingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !account?.address) return;

    async function loadData() {
      setLoading(true);
      try {
        const [npcObjects, bunkerObjects] = await Promise.all([
          getOwnedObjects(account!.address, getObjectType("npc", "NPC")),
          getOwnedObjects(account!.address, getObjectType("bunker", "Bunker")),
        ]);
        
        const cleaned = (npcObjects as NPC[]).filter((n) => !!n && !!(n as any).id);
        setNpcs(cleaned);
        
        if (bunkerObjects.length > 0) {
          setBunker(bunkerObjects[0] as Bunker);
        }

        setSelectedNpc((prev) => {
          if (prev?.id) {
            const stillThere = cleaned.find((n) => n.id === prev.id);
            if (stillThere) return stillThere;
          }
          return cleaned.length > 0 ? cleaned[0] : null;
        });
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }

    async function loadItems() {
      setItemsLoading(true);
      try {
        const itemObjects = await getOwnedObjects(
          account!.address,
          getObjectType("item", "Item")
        );
        setItems((itemObjects as Item[]).filter((i) => !!i && !!(i as any).id));
      } catch (error) {
        console.error("Error loading items:", error);
      } finally {
        setItemsLoading(false);
      }
    }

    loadData();
    loadItems();
  }, [isOpen, account]);

  const consumables = items.filter((it) =>
    it.item_type === ITEM_TYPES.FOOD ||
    it.item_type === ITEM_TYPES.WATER ||
    it.item_type === ITEM_TYPES.MEDICINE ||
    it.item_type === ITEM_TYPES.REVIVAL_POTION
  );

  const itemTypeName = (itemType: number): string => {
    switch (itemType) {
      case ITEM_TYPES.FOOD:
        return "Food";
      case ITEM_TYPES.WATER:
        return "Water";
      case ITEM_TYPES.MEDICINE:
        return "Medicine";
      case ITEM_TYPES.REVIVAL_POTION:
        return "Revival";
      default:
        return "Item";
    }
  };

  const getItemRarityName = (rarity: number): string => {
    // Item rarity on-chain: 1..4
    if (rarity === 1) return "Common";
    if (rarity === 2) return "Rare";
    if (rarity === 3) return "Epic";
    if (rarity === 4) return "Legendary";
    return (RARITY_NAMES as any)[rarity] ?? String(rarity);
  };

  const handleBunkerAction = async (action: "feed" | "water") => {
    if (!account?.address || !selectedNpc?.id || !bunker?.id) return;

    setActionLoadingItemId("bunker-action");
    try {
      const tx = new TransactionBlock();
      const npcArg = tx.object(selectedNpc.id);
      const bunkerArg = tx.object(bunker.id);
      
      if (action === "feed") {
        tx.moveCall({
          target: `${PACKAGE_ID}::npc::feed_npc_from_bunker`,
          arguments: [npcArg, bunkerArg, tx.pure(20, "u64")],
        });
      } else {
         tx.moveCall({
          target: `${PACKAGE_ID}::npc::give_water_from_bunker`,
          arguments: [npcArg, bunkerArg, tx.pure(20, "u64")],
        });
      }

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
             // Dispatch events to update Bunker Header and NPC list
             window.dispatchEvent(new Event("bunker-updated"));
             window.dispatchEvent(new Event("npcs-updated"));

             setTimeout(async () => {
                // Determine which objects to reload based on what we have getters for or just reload all
                // For simplicity, we re-trigger the useEffect load flow by toggling a refresh or just calling loadData if we extracted it.
                // But since we are inside the component, let's just re-fetch what we need.
                if (!account?.address) return;

                try {
                  const [npcObjects, bunkerObjects] = await Promise.all([
                    getOwnedObjects(account.address, getObjectType("npc", "NPC")),
                    getOwnedObjects(account.address, getObjectType("bunker", "Bunker")),
                  ]);
                  
                  const cleaned = (npcObjects as NPC[]).filter((n) => !!n && !!(n as any).id);
                  setNpcs(cleaned);
                  if (bunkerObjects.length > 0) setBunker(bunkerObjects[0] as Bunker);
                  
                  setSelectedNpc((prev) => {
                     if (prev?.id) return cleaned.find((n) => n.id === prev.id) || null;
                     return null;
                  });
                } catch (e) {
                  console.error("Refetch error", e);
                } finally {
                  setActionLoadingItemId(null);
                }
             }, 1000);
          },
          onError: (err) => {
            console.error(err);
            alert("Action failed");
            setActionLoadingItemId(null);
          }
        }
      );
    } catch (e) {
      console.error(e);
      setActionLoadingItemId(null);
    }
  };

  const handleUseConsumable = async (item: Item) => {
    if (!account?.address || !selectedNpc?.id) return;

    setActionLoadingItemId(item.id);
    try {
      const tx = new TransactionBlock();
      const npcArg = tx.object(selectedNpc.id);
      const itemArg = tx.object(item.id);
      const clockArg = tx.object("0x6");

      const target =
        item.item_type === ITEM_TYPES.FOOD
          ? `${PACKAGE_ID}::npc::consume_food`
          : item.item_type === ITEM_TYPES.WATER
            ? `${PACKAGE_ID}::npc::consume_water_item`
            : item.item_type === ITEM_TYPES.MEDICINE
              ? `${PACKAGE_ID}::npc::consume_medicine`
              : `${PACKAGE_ID}::npc::revive_npc`;

      tx.moveCall({
        target,
        arguments: [npcArg, itemArg, clockArg],
      });

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            // Refresh objects after the transaction settles.
            setTimeout(async () => {
              if (!account?.address) return;
              try {
                const [npcObjects, itemObjects] = await Promise.all([
                  getOwnedObjects(account.address, getObjectType("npc", "NPC")),
                  getOwnedObjects(account.address, getObjectType("item", "Item")),
                ]);

                const cleanedNpcs = (npcObjects as NPC[]).filter((n) => !!n && !!(n as any).id);
                setNpcs(cleanedNpcs);
                setSelectedNpc((prev) => {
                  if (prev?.id) {
                    const stillThere = cleanedNpcs.find((n) => n.id === prev.id);
                    if (stillThere) return stillThere;
                  }
                  return cleanedNpcs.length > 0 ? cleanedNpcs[0] : null;
                });

                setItems((itemObjects as Item[]).filter((i) => !!i && !!(i as any).id));
              } catch (e) {
                console.error("Error refreshing after consumable use:", e);
              } finally {
                setActionLoadingItemId(null);
              }
            }, 1200);
          },
          onError: (error: any) => {
            console.error("Use item error:", error);
            alert("Use item failed: " + (error?.message ?? String(error)));
            setActionLoadingItemId(null);
          },
        }
      );
    } catch (error: any) {
      console.error("Use item error:", error);
      alert("Use item failed: " + (error?.message ?? String(error)));
      setActionLoadingItemId(null);
    }
  };

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
                    <SpriteSheet
                      src={getNPCSpriteUrl(selectedNpc.rarity, selectedNpc.profession)}
                      frameWidth={128}
                      frameHeight={128}
                      fps={12}
                      playing={true}
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
                        <span className="text-gray-400">Type:</span>
                        <span className="ml-2 font-bold">Survivor</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Profession:</span>
                        <span className="ml-2 font-bold">
                          {NPC_PROFESSION_NAMES[selectedNpc.profession as keyof typeof NPC_PROFESSION_NAMES] || selectedNpc.profession}
                        </span>
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



                    <div className="border-t border-gray-600 pt-3">
                      <div className="text-sm font-bold text-gray-300 mb-2">Bunker Rationing</div>
                      {bunker ? (
                         <div className="grid grid-cols-2 gap-3">
                            <button
                              disabled={!!actionLoadingItemId || selectedNpc.hunger >= 100 || bunker.food < 20}
                              onClick={() => handleBunkerAction("feed")}
                              className="bg-orange-600/20 hover:bg-orange-600/40 disabled:opacity-50 border border-orange-500/50 rounded p-2 flex flex-col items-center gap-1 transition-all"
                            >
                               <span className="text-orange-400 font-bold text-xs">FEED (20)</span>
                               <span className="text-[10px] text-gray-400">Costs 20 Food</span>
                            </button>
                            <button
                              disabled={!!actionLoadingItemId || selectedNpc.thirst >= 100 || bunker.water < 20}
                              onClick={() => handleBunkerAction("water")}
                              className="bg-blue-600/20 hover:bg-blue-600/40 disabled:opacity-50 border border-blue-500/50 rounded p-2 flex flex-col items-center gap-1 transition-all"
                            >
                               <span className="text-blue-400 font-bold text-xs">DRINK (20)</span>
                               <span className="text-[10px] text-gray-400">Costs 20 Water</span>
                            </button>
                         </div>
                      ) : (
                        <div className="text-xs text-gray-400">Data unavailable</div>
                      )}
                    </div>

                    <div className="border-t border-gray-600 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-300">Consumables</div>
                        {itemsLoading ? (
                          <div className="text-xs text-gray-400">Loading...</div>
                        ) : (
                          <div className="text-xs text-gray-400">{consumables.length} items</div>
                        )}
                      </div>

                      {consumables.length === 0 ? (
                        <div className="text-xs text-gray-400">No consumables owned</div>
                      ) : (
                        <div className="space-y-2">
                          {consumables.slice(0, 6).map((it) => {
                            const isRevive = it.item_type === ITEM_TYPES.REVIVAL_POTION;
                            const reviveDisabled = isRevive && selectedNpc.status !== NPC_STATUS.KNOCKED;
                            const disabled = !!actionLoadingItemId || reviveDisabled;

                            return (
                              <div
                                key={it.id}
                                className="flex items-center justify-between rounded bg-gray-800/60 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs text-gray-300 truncate">{it.name}</div>
                                  <div className="text-[11px] text-gray-400">
                                    {itemTypeName(it.item_type)} · {getItemRarityName(it.rarity)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleUseConsumable(it)}
                                  disabled={disabled}
                                  className={`ml-3 px-3 py-1 rounded text-xs font-bold transition-colors ${
                                    disabled
                                      ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                                      : "bg-green-600 hover:bg-green-500 text-white"
                                  }`}
                                  title={
                                    reviveDisabled
                                      ? "Revival only works when NPC is knocked"
                                      : ""
                                  }
                                >
                                  {actionLoadingItemId === it.id ? "Using..." : "Use"}
                                </button>
                              </div>
                            );
                          })}

                          {consumables.length > 6 ? (
                            <div className="text-[11px] text-gray-400">
                              +{consumables.length - 6} more (see Inventory)
                            </div>
                          ) : null}
                        </div>
                      )}
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
