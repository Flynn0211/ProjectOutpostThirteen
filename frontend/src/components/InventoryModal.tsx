import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import type { Blueprint, Item, NPC } from "../types";
import { getBlueprintImageUrl, getItemImageUrl } from "../utils/imageUtils";
import { ITEM_TYPES, NPC_STATUS, PACKAGE_ID, RARITY_NAMES } from "../constants";

type InventoryEntry =
  | { kind: "item"; id: string; item: Item }
  | { kind: "blueprint"; id: string; blueprint: Blueprint };

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [items, setItems] = useState<Item[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(false);

  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [npcsLoading, setNpcsLoading] = useState(false);
  const [selectedNpcId, setSelectedNpcId] = useState<string>("");
  const [actionLoadingItemId, setActionLoadingItemId] = useState<string | null>(null);

  const getItemRarityName = (rarity: number): string => {
    // Item rarity on-chain: 1..4
    if (rarity === 1) return "Common";
    if (rarity === 2) return "Rare";
    if (rarity === 3) return "Epic";
    if (rarity === 4) return "Legendary";
    // Fallback (in case some items are using 0..5 like NPCs)
    return (RARITY_NAMES as any)[rarity] ?? String(rarity);
  };

  useEffect(() => {
    if (!isOpen || !account?.address) return;

    async function loadItems() {
      setLoading(true);
      try {
        const [itemObjects, blueprintObjects] = await Promise.all([
          getOwnedObjects(account!.address, getObjectType("item", "Item")),
          getOwnedObjects(account!.address, getObjectType("crafting", "Blueprint")),
        ]);
        setItems((itemObjects as Item[]).filter((i) => !!i && !!(i as any).id));
        setBlueprints((blueprintObjects as Blueprint[]).filter((b) => !!b && !!(b as any).id));
      } catch (error) {
        console.error("Error loading items:", error);
      } finally {
        setLoading(false);
      }
    }

    async function loadNPCs() {
      setNpcsLoading(true);
      try {
        const npcObjects = await getOwnedObjects(
          account!.address,
          getObjectType("npc", "NPC")
        );
        const cleaned = (npcObjects as NPC[]).filter((n) => !!n && !!(n as any).id);
        setNpcs(cleaned);
        setSelectedNpcId((prev) => {
          if (prev && cleaned.some((n) => n.id === prev)) return prev;
          return cleaned.length > 0 ? cleaned[0].id : "";
        });
      } catch (error) {
        console.error("Error loading NPCs:", error);
      } finally {
        setNpcsLoading(false);
      }
    }

    loadItems();
    loadNPCs();
  }, [isOpen, account]);

  useEffect(() => {
    if (!isOpen || !account?.address) return;

    const onInventoryUpdated = () => {
      // Reload items/blueprints when another part of the app updates inventory.
      (async () => {
        try {
          const [itemObjects, blueprintObjects] = await Promise.all([
            getOwnedObjects(account.address, getObjectType("item", "Item")),
            getOwnedObjects(account.address, getObjectType("crafting", "Blueprint")),
          ]);
          setItems((itemObjects as Item[]).filter((i) => !!i && !!(i as any).id));
          setBlueprints((blueprintObjects as Blueprint[]).filter((b) => !!b && !!(b as any).id));
        } catch (e) {
          console.error("Error refreshing inventory:", e);
        }
      })();
    };

    window.addEventListener("inventory-updated", onInventoryUpdated);
    return () => window.removeEventListener("inventory-updated", onInventoryUpdated);
  }, [isOpen, account]);

  const selectedNpc = npcs.find((n) => n.id === selectedNpcId) ?? null;

  const isConsumable = (itemType: number): boolean => {
    return (
      itemType === ITEM_TYPES.FOOD ||
      itemType === ITEM_TYPES.WATER ||
      itemType === ITEM_TYPES.MEDICINE ||
      itemType === ITEM_TYPES.REVIVAL_POTION
    );
  };

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
      case ITEM_TYPES.WEAPON:
        return "Weapon";
      case ITEM_TYPES.ARMOR:
        return "Armor";
      case ITEM_TYPES.TOOL:
        return "Tool";
      default:
        return "Item";
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
            setTimeout(async () => {
              if (!account?.address) return;
              try {
                const [npcObjects, itemObjects] = await Promise.all([
                  getOwnedObjects(account.address, getObjectType("npc", "NPC")),
                  getOwnedObjects(account.address, getObjectType("item", "Item")),
                ]);
                const cleanedNpcs = (npcObjects as NPC[]).filter((n) => !!n && !!(n as any).id);
                setNpcs(cleanedNpcs);
                setSelectedNpcId((prev) => {
                  if (prev && cleanedNpcs.some((n) => n.id === prev)) return prev;
                  return cleanedNpcs.length > 0 ? cleanedNpcs[0].id : "";
                });
                setItems((itemObjects as Item[]).filter((i) => !!i && !!(i as any).id));
              } catch (e) {
                console.error("Error refreshing after using item:", e);
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

  const entries: InventoryEntry[] = [
    ...blueprints.map((bp) => ({ kind: "blueprint" as const, id: bp.id, blueprint: bp })),
    ...items.map((it) => ({ kind: "item" as const, id: it.id, item: it })),
  ];

  const SLOTS_PER_ROW = 15;
  const filledCount = entries.length;
  const rowCount = Math.max(1, Math.ceil(filledCount / SLOTS_PER_ROW));
  const totalSlots = rowCount * SLOTS_PER_ROW;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#5fffc0] rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#5fffc0] rounded-br-2xl" />

        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer" />

        <div className="relative flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">Inventory</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

          <div className="relative mb-6">
            <div className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-white text-sm">
                  <div className="font-bold text-[#4deeac] uppercase tracking-wider">Use on NPC</div>
                  <div className="text-xs text-white/70">Select an NPC to use consumables from inventory</div>
                </div>

                {npcsLoading ? (
                  <div className="text-white/70 text-sm">Loading NPCs...</div>
                ) : npcs.length === 0 ? (
                  <div className="text-white/70 text-sm">No NPCs owned</div>
                ) : (
                  <select
                    value={selectedNpcId}
                    onChange={(e) => setSelectedNpcId(e.target.value)}
                    className="bg-[#0d1117] text-white border border-[#4deeac] rounded px-3 py-2 text-sm"
                  >
                    {npcs.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} (Lv {n.level})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedNpc ? (
                <div className="mt-3 text-xs text-white/70">
                  Status: {selectedNpc.status === NPC_STATUS.KNOCKED ? "Knocked" : selectedNpc.status === NPC_STATUS.WORKING ? "Working" : selectedNpc.status === NPC_STATUS.ON_MISSION ? "On Mission" : "Idle"}
                </div>
              ) : null}
            </div>
          </div>

        {loading ? (
          <div className="text-white text-center py-8">Loading items...</div>
        ) : entries.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No items in inventory</div>
        ) : (
          <div className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4">
            <div className="text-xs text-white/70 mb-3">
              Hover vào ô có đồ để xem thông tin.
            </div>

            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${SLOTS_PER_ROW}, 2rem)` }}
            >
              {Array.from({ length: totalSlots }).map((_, idx) => {
                const entry = entries[idx] ?? null;

                if (!entry) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="w-8 h-8 bg-[#0d1117] border border-[#4deeac] rounded"
                    />
                  );
                }

                const isItem = entry.kind === "item";
                const slotId = entry.id;
                const slotImg = isItem
                  ? getItemImageUrl(entry.item.item_type, entry.item.rarity)
                  : getBlueprintImageUrl();

                const title = isItem ? entry.item.name : "Blueprint";

                const canUse =
                  isItem &&
                  isConsumable(entry.item.item_type) &&
                  !!selectedNpc &&
                  !(
                    entry.item.item_type === ITEM_TYPES.REVIVAL_POTION &&
                    selectedNpc.status !== NPC_STATUS.KNOCKED
                  );
                const useDisabled =
                  !canUse || !!actionLoadingItemId || (isItem && actionLoadingItemId === entry.item.id);

                return (
                  <div key={slotId} className="relative group">
                    <div className="w-8 h-8 bg-[#0d1117] border border-[#4deeac] rounded overflow-hidden">
                      <img
                        src={slotImg}
                        alt={title}
                        className="w-8 h-8 object-cover"
                        draggable={false}
                      />
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                      <div className="w-64 bg-[#1a1f2e] border-2 border-[#4deeac] rounded-lg p-3 shadow-[0_0_20px_rgba(77,238,172,0.35)]">
                        <div className="text-sm font-bold text-white truncate">{title}</div>

                        {isItem ? (
                          <div className="mt-1 text-xs text-white/80 space-y-0.5">
                            <div>
                              <span className="text-[#4deeac]">Độ hiếm:</span> {getItemRarityName(entry.item.rarity)}
                            </div>
                            <div>
                              <span className="text-[#4deeac]">Loại:</span> {itemTypeName(entry.item.item_type)}
                            </div>
                            {entry.item.durability !== undefined ? (
                              <div>
                                <span className="text-[#4deeac]">Độ bền:</span> {entry.item.durability}/{entry.item.max_durability}
                              </div>
                            ) : null}

                            {isConsumable(entry.item.item_type) ? (
                              <div className="pt-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!useDisabled) handleUseConsumable(entry.item);
                                  }}
                                  disabled={useDisabled}
                                  className={`w-full px-3 py-2 rounded text-xs font-bold transition-all ${
                                    useDisabled
                                      ? "bg-gray-700 text-gray-300 cursor-not-allowed"
                                      : "bg-[#4deeac] text-[#0d1117] hover:bg-[#5fffc0]"
                                  }`}
                                  title={!selectedNpc ? "Chọn NPC trước" : ""}
                                >
                                  {actionLoadingItemId === entry.item.id ? "Đang dùng..." : "Dùng"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-white/80 space-y-0.5">
                            <div>
                              <span className="text-[#4deeac]">Độ hiếm:</span> {entry.blueprint.rarity}
                            </div>
                            <div>
                              <span className="text-[#4deeac]">Loại:</span> {entry.blueprint.item_type}
                            </div>
                            <div>
                              <span className="text-[#4deeac]">Lượt dùng:</span> {entry.blueprint.uses_remaining}/{entry.blueprint.max_uses}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

