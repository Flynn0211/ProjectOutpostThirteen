import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTransaction } from "../hooks/useTransaction";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import type { Item, NPC, Bunker } from "../types";
import { getNPCSpriteUrl } from "../utils/imageUtils";
import { SpriteSheet } from "./SpriteSheet";
import { ITEM_TYPES, NPC_STATUS, PACKAGE_ID, RARITY_NAMES, NPC_PROFESSION_NAMES } from "../constants";
import { useNpcEquipment } from "../hooks/useNpcEquipment";
import { getItemImageUrl } from "../utils/imageUtils";

interface NPCManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInventory: (npcId: string) => void;
}

const NPC_STATUS_NAMES = {
  [0]: "Idle",
  [1]: "On Mission",
  [2]: "Knocked",
  [3]: "Working",
};

export function NPCManagerModal({ isOpen, onClose, onOpenInventory }: NPCManagerModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useTransaction();
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NPC | null>(null);
  const [bunker, setBunker] = useState<Bunker | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionLoadingItemId, setActionLoadingItemId] = useState<string | null>(null);
  const [selectedNpcFrameCount, setSelectedNpcFrameCount] = useState<number | undefined>(undefined);

  const { equipment, loading: equipmentLoading, refresh: refreshEquipment } = useNpcEquipment(selectedNpc?.id || null);

  const handleUnequip = async (slotType: "weapon" | "armor" | "tool1" | "tool2") => {
      if (!account?.address || !selectedNpc?.id) return;
      setActionLoadingItemId("unequip-" + slotType);

      try {
          const tx = new TransactionBlock();
          const npcArg = tx.object(selectedNpc.id);
          const clockArg = tx.object("0x6");
          
          let target = "";
          if (slotType === "weapon") target = `${PACKAGE_ID}::npc::unequip_weapon`;
          else if (slotType === "armor") target = `${PACKAGE_ID}::npc::unequip_armor`;
          else if (slotType === "tool1") target = `${PACKAGE_ID}::npc::unequip_tool_1`;
          else if (slotType === "tool2") target = `${PACKAGE_ID}::npc::unequip_tool_2`;

          tx.moveCall({
              target: target as any,
              arguments: [npcArg, clockArg],
          });

          signAndExecute({ transactionBlock: tx }, {
              onSuccess: () => {
                  setTimeout(() => {
                      refreshEquipment();
                      // Refresh items in inventory because unequipped item goes there
                      window.dispatchEvent(new Event("inventory-updated"));
                  }, 1200);
              },
              onError: (err) => {
                  console.error(err);
                  alert("Unequip failed");
                  setActionLoadingItemId(null);
              }
          });
      } catch (e) {
          console.error(e);
          setActionLoadingItemId(null);
      } finally {
        // loading state cleared in onError/onSuccess or manually here if needed
        // but we rely on async flow. Actually better to clear it in finally block if we await, 
        // but signAndExecute is callback based. 
        // So we clear it in callbacks.
      }
  };

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
        (
          item.item_type === ITEM_TYPES.FOOD
            ? `${PACKAGE_ID}::npc::consume_food`
            : item.item_type === ITEM_TYPES.WATER
              ? `${PACKAGE_ID}::npc::consume_water_item`
              : item.item_type === ITEM_TYPES.MEDICINE
                ? `${PACKAGE_ID}::npc::consume_medicine`
                : `${PACKAGE_ID}::npc::revive_npc`
        ) as `${string}::${string}::${string}`;

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

          <div className="grid grid-cols-2 gap-6 min-h-[500px]">
            {/* NPC List */}
            <div className="flex flex-col h-full max-h-[80vh] bg-gray-900/40 rounded-xl p-4 border border-gray-700/50">
              <h3 className="text-lg font-bold text-[#4deeac] mb-3 uppercase tracking-wider flex items-center gap-2">
                <span>👥</span> Your NPCs
              </h3>
              <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {npcs.map((npc) => {
                  const isSelected = selectedNpc?.id === npc.id;
                  
                  // Status-based styling
                  let statusColor = "text-gray-400";
                  let statusBg = "bg-gray-800";
                  let statusBorder = "border-transparent";

                  switch (npc.status) {
                    case NPC_STATUS.WORKING:
                      statusColor = "text-yellow-400";
                      statusBg = isSelected ? "bg-yellow-900/40" : "bg-yellow-900/10";
                      statusBorder = isSelected ? "border-yellow-400" : "border-yellow-600/30";
                      break;
                    case NPC_STATUS.ON_MISSION:
                      statusColor = "text-blue-400";
                      statusBg = isSelected ? "bg-blue-900/40" : "bg-blue-900/10";
                      statusBorder = isSelected ? "border-blue-400" : "border-blue-600/30";
                      break;
                    case NPC_STATUS.KNOCKED:
                      statusColor = "text-red-400";
                      statusBg = isSelected ? "bg-red-900/40" : "bg-red-900/10";
                      statusBorder = isSelected ? "border-red-400" : "border-red-600/30";
                      break;
                    case NPC_STATUS.IDLE:
                    default:
                      statusColor = "text-green-400";
                      statusBg = isSelected ? "bg-green-900/40" : "bg-gray-800";
                      statusBorder = isSelected ? "border-green-400" : "border-gray-700";
                      break;
                  }

                  return (
                  <div
                    key={npc.id || Math.random()}
                    onClick={() => {
                      if (!npc) return;
                      setSelectedNpcFrameCount(undefined);
                      setSelectedNpc(npc);
                    }}
                    className={`
                      relative p-3 rounded-lg cursor-pointer transition-all border-2
                      flex items-center gap-3 overflow-hidden
                      ${statusBg} ${statusBorder}
                      ${isSelected ? "shadow-[0_0_15px_rgba(0,0,0,0.5)] scale-[1.02] z-10" : "hover:border-gray-500 hover:bg-gray-700/80"}
                    `}
                  >
                     {/* Avatar Thumbnail */}
                     <div className="relative w-12 h-12 rounded-md bg-gray-900/50 border border-white/10 shrink-0 overflow-hidden">
                        <div 
                            className="w-full h-full"
                            style={{
                                backgroundImage: `url(${getNPCSpriteUrl(npc.rarity, npc.profession)})`,
                                backgroundPosition: '0 0',
                                backgroundSize: 'auto 100%',
                                backgroundRepeat: 'no-repeat',
                                imageRendering: 'pixelated'
                            }}
                        />
                     </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                         <div className={`font-bold truncate ${isSelected ? "text-white" : "text-gray-200"}`}>{npc.name}</div>
                         <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${statusColor} bg-black/40 border border-current/20`}>
                            {NPC_STATUS_NAMES[npc.status as keyof typeof NPC_STATUS_NAMES]}
                         </div>
                      </div>
                      
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                         <span className={RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES] === "Legendary" ? "text-orange-400" : "text-gray-500"}>
                            {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]}
                         </span>
                         <span className="w-1 h-1 rounded-full bg-gray-600" />
                         <span className="text-gray-500">Lvl {npc.level}</span>
                         <span className="w-1 h-1 rounded-full bg-gray-600" />
                         <span className="text-gray-300">{NPC_PROFESSION_NAMES[npc.profession as keyof typeof NPC_PROFESSION_NAMES]}</span>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* NPC Details */}
            {selectedNpc ? (
              <div className="flex flex-col h-full bg-gray-900/40 rounded-xl p-4 border border-gray-700/50">
                <h3 className="text-lg font-bold text-[#4deeac] mb-3 uppercase tracking-wider flex items-center gap-2">
                  <span>📝</span> Details
                </h3>
                <div className="space-y-3">
                  <div className="w-full bg-gray-800/80 rounded-lg border border-gray-600/50 h-40 flex items-center justify-center relative">
                    <div style={{ transform: "scale(1.2)", transformOrigin: "center" }}>
                      <SpriteSheet
                        src={getNPCSpriteUrl(selectedNpc.rarity, selectedNpc.profession)}
                        frameWidth={128}
                        frameHeight={128}
                        fps={10}
                        startFrame={0}
                        frameCount={Math.max(1, Math.min(4, selectedNpcFrameCount ?? 4))}
                        playing={(selectedNpcFrameCount ?? 8) >= 8}
                        onMeta={(m) => setSelectedNpcFrameCount(m.frameCount)}
                      />
                    </div>
                  </div>
                  
                  <div className="text-white space-y-2">
                    <div className="flex justify-between items-center">
                       <div className="text-xl font-bold">{selectedNpc.name}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1 text-sm">
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

                    <div className="border-t border-gray-600 pt-2">
                       <div className="text-sm font-bold text-gray-300 mb-2">Equipment</div>
                       {equipmentLoading ? (
                          <div className="text-xs text-gray-400">Loading equipment...</div>
                       ) : (
                          <div className="grid grid-cols-4 gap-2">
                             {/* Weapon */}
                             <div className="flex flex-col items-center">
                                <div className={`relative w-12 h-12 bg-gray-800 border ${equipment.weapon ? "border-" + RARITY_NAMES[equipment.weapon.rarity as keyof typeof RARITY_NAMES]?.toLowerCase() + "-400" : "border-gray-600 border-dashed"} rounded-lg flex items-center justify-center`}>
                                   {equipment.weapon ? (
                                      <>
                                        <img src={getItemImageUrl(equipment.weapon.item_type, equipment.weapon.rarity)} className="w-8 h-8 object-contain" />
                                        <button 
                                          onClick={() => handleUnequip("weapon")}
                                          disabled={!!actionLoadingItemId}
                                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-red-600"
                                        >
                                          ×
                                        </button>
                                      </>
                                   ) : (
                                       <button 
                                        onClick={() => selectedNpc && onOpenInventory(selectedNpc.id)}
                                        className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] hover:text-[#4deeac] hover:bg-white/5 transition-all"
                                      >
                                        WPN
                                      </button>
                                   )}
                                </div>
                             </div>

                             {/* Armor */}
                             <div className="flex flex-col items-center">
                                <div className={`relative w-12 h-12 bg-gray-800 border ${equipment.armor ? "border-" + RARITY_NAMES[equipment.armor.rarity as keyof typeof RARITY_NAMES]?.toLowerCase() + "-400" : "border-gray-600 border-dashed"} rounded-lg flex items-center justify-center`}>
                                   {equipment.armor ? (
                                      <>
                                        <img src={getItemImageUrl(equipment.armor.item_type, equipment.armor.rarity)} className="w-8 h-8 object-contain" />
                                        <button 
                                          onClick={() => handleUnequip("armor")}
                                          disabled={!!actionLoadingItemId}
                                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-red-600"
                                        >
                                          ×
                                        </button>
                                      </>
                                   ) : (
                                       <button 
                                        onClick={() => selectedNpc && onOpenInventory(selectedNpc.id)}
                                        className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] hover:text-[#4deeac] hover:bg-white/5 transition-all"
                                      >
                                        ARM
                                      </button>
                                   )}
                                </div>
                             </div>

                             {/* Tool 1 */}
                             <div className="flex flex-col items-center">
                                <div className={`relative w-12 h-12 bg-gray-800 border ${equipment.tool1 ? "border-" + RARITY_NAMES[equipment.tool1.rarity as keyof typeof RARITY_NAMES]?.toLowerCase() + "-400" : "border-gray-600 border-dashed"} rounded-lg flex items-center justify-center`}>
                                   {equipment.tool1 ? (
                                      <>
                                        <img src={getItemImageUrl(equipment.tool1.item_type, equipment.tool1.rarity)} className="w-8 h-8 object-contain" />
                                        <button 
                                          onClick={() => handleUnequip("tool1")}
                                          disabled={!!actionLoadingItemId}
                                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-red-600"
                                        >
                                          ×
                                        </button>
                                      </>
                                   ) : (
                                       <button 
                                        onClick={() => selectedNpc && onOpenInventory(selectedNpc.id)}
                                        className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] hover:text-[#4deeac] hover:bg-white/5 transition-all"
                                      >
                                        TL1
                                      </button>
                                   )}
                                </div>
                             </div>

                              {/* Tool 2 */}
                             <div className="flex flex-col items-center">
                                <div className={`relative w-12 h-12 bg-gray-800 border ${equipment.tool2 ? "border-" + RARITY_NAMES[equipment.tool2.rarity as keyof typeof RARITY_NAMES]?.toLowerCase() + "-400" : "border-gray-600 border-dashed"} rounded-lg flex items-center justify-center`}>
                                   {equipment.tool2 ? (
                                      <>
                                        <img src={getItemImageUrl(equipment.tool2.item_type, equipment.tool2.rarity)} className="w-8 h-8 object-contain" />
                                        <button 
                                          onClick={() => handleUnequip("tool2")}
                                          disabled={!!actionLoadingItemId}
                                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center hover:bg-red-600"
                                        >
                                          ×
                                        </button>
                                      </>
                                   ) : (
                                      <button 
                                        onClick={() => selectedNpc && onOpenInventory(selectedNpc.id)}
                                        className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] hover:text-[#4deeac] hover:bg-white/5 transition-all"
                                      >
                                        TL2
                                      </button>
                                   )}
                                </div>
                             </div>
                          </div>
                       )}
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
