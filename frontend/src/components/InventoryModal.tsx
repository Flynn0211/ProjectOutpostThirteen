import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useQueryClient } from "@tanstack/react-query";
import type { Blueprint, Item } from "../types";
import { getBlueprintImageUrl, getItemImageUrl } from "../utils/imageUtils";
import { ITEM_TYPES, NPC_STATUS, PACKAGE_ID, RARITY_NAMES } from "../constants";
import { useMarketplace } from "../hooks/useMarketplace";
import { useInventory } from "../hooks/useInventory";
import { postTxRefresh } from "../utils/postTxRefresh";

type InventoryEntry =
  | { kind: "item"; id: string; item: Item }
  | { kind: "blueprint"; id: string; blueprint: Blueprint };

interface TooltipData {
  entry: InventoryEntry;
  rect: DOMRect;
}

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId?: string;
}

export function InventoryModal({ isOpen, onClose, bunkerId }: InventoryModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const { listItem } = useMarketplace();
  const queryClient = useQueryClient();
  const [selectedNpcId, setSelectedNpcId] = useState<string>("");
  const [actionLoadingItemId, setActionLoadingItemId] = useState<string | null>(null);

  // Tooltip state
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (entry: InventoryEntry, e: React.MouseEvent) => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipData({ entry, rect });
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      setTooltipData(null);
    }, 150); // Small delay to allow moving to the tooltip itself
  };

  const handleTooltipEnter = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  };

  const getItemRarityName = (rarity: number): string => {
    // Item rarity on-chain: 1..4
    if (rarity === 1) return "Common";
    if (rarity === 2) return "Rare";
    if (rarity === 3) return "Epic";
    if (rarity === 4) return "Legendary";
    // Fallback (in case some items are using 0..5 like NPCs)
    return (RARITY_NAMES as any)[rarity] ?? String(rarity);
  };

  const ceilDiv = (n: number, d: number): number => Math.floor((n + (d - 1)) / d);

  const getItemRating = (item: Item): number => {
    const level = 1; // On-chain items currently default to level=1
    return level * 10 + item.rarity * 50;
  };

  const getEstimatedRepairScrapCost = (item: Item): number | null => {
    if (item.durability === undefined || item.max_durability === undefined) return null;
    const lost = item.max_durability - item.durability;
    if (lost <= 0) return 0;

    const rarityCoef =
      item.rarity === 1 ? 1 : item.rarity === 2 ? 2 : item.rarity === 3 ? 5 : item.rarity === 4 ? 15 : 1;
    const level = 1;

    let cost = lost * rarityCoef;
    cost = ceilDiv(cost * (10 + level), 10);
    if (item.durability === 0) cost = ceilDiv(cost * 120, 100);

    return cost;
  };

  const handleRepairItem = async (item: Item) => {
    if (!account?.address || !bunkerId) return;
    if (item.durability === undefined || item.max_durability === undefined) return;
    if (item.durability >= item.max_durability) return;

    setActionLoadingItemId(item.id);
    try {
      const tx = new TransactionBlock();
      const clockArg = tx.object("0x6");

      tx.moveCall({
        target: `${PACKAGE_ID}::bunker::repair_item`,
        arguments: [tx.object(item.id), tx.object(bunkerId), tx.gas, clockArg],
      });

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            postTxRefresh(queryClient, account.address);
            setActionLoadingItemId(null);
            setTooltipData(null);
          },
          onError: (error: any) => {
            console.error("Repair item error:", error);
            alert("Repair failed: " + (error?.message ?? String(error)));
            setActionLoadingItemId(null);
          },
        }
      );
    } catch (error: any) {
      console.error("Repair item error:", error);
      alert("Repair failed: " + (error?.message ?? String(error)));
      setActionLoadingItemId(null);
    }
  };

  const handleCraftBandageFromCloth = async (clothItem: Item) => {
    if (!account?.address || !bunkerId) return;
    if (clothItem.item_type !== ITEM_TYPES.CLOTH) return;

    setActionLoadingItemId(clothItem.id);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::crafting::craft_bandage_from_cloth`,
        arguments: [tx.object(clothItem.id), tx.object(bunkerId), tx.object("0x6")],
      });

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            postTxRefresh(queryClient, account.address);
            setActionLoadingItemId(null);
            setTooltipData(null);
          },
          onError: (error: any) => {
            console.error("Craft bandage error:", error);
            alert("Craft failed: " + (error?.message ?? String(error)));
            setActionLoadingItemId(null);
          },
        }
      );
    } catch (error: any) {
      console.error("Craft bandage error:", error);
      alert("Craft failed: " + (error?.message ?? String(error)));
      setActionLoadingItemId(null);
    }
  };

  // Shared inventory hook
  const { items, blueprints, npcs, loading, refresh: refreshInventory } = useInventory(isOpen);

  useEffect(() => {
    // Select first NPC if available and none selected
    if (npcs.length > 0 && !selectedNpcId) {
      setSelectedNpcId(npcs[0].id);
    } else if (selectedNpcId && !npcs.find((n) => n.id === selectedNpcId)) {
      // If selected NPC is gone (e.g. sold or error), select first available or empty
      setSelectedNpcId(npcs.length > 0 ? npcs[0].id : "");
    }
  }, [npcs, selectedNpcId]);

  const selectedNpc = npcs.find((n) => n.id === selectedNpcId) ?? null;

  const isConsumable = (itemType: number): boolean => {
    return (
      itemType === ITEM_TYPES.FOOD ||
      itemType === ITEM_TYPES.WATER ||
      itemType === ITEM_TYPES.MEDICINE ||
      itemType === ITEM_TYPES.BANDAGE ||
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
      case ITEM_TYPES.CLOTH:
        return "Cloth";
      case ITEM_TYPES.BANDAGE:
        return "Bandage";
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
                : item.item_type === ITEM_TYPES.BANDAGE
                  ? `${PACKAGE_ID}::npc::consume_bandage`
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
              await refreshInventory();
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

  // List Item Logic
  const [listingPrice, setListingPrice] = useState<string>("");
  const [isListingMode, setIsListingMode] = useState(false);

  const handleListCallback = async (item: Item) => {
    if (!listingPrice || isNaN(Number(listingPrice))) {
      alert("Please enter a valid price in SUI");
      return;
    }

    const priceInMist = Math.floor(Number(listingPrice) * 1_000_000_000).toString();

    setActionLoadingItemId(item.id);
    try {
      await listItem(item.id, priceInMist, signAndExecute);
      alert(`Listed ${item.name} for ${listingPrice} SUI successful!`);
      // Refresh
      refreshInventory();
    } catch (err: any) {
      console.error(err);
      alert("Listing failed: " + err.message);
    } finally {
      setActionLoadingItemId(null);
      setListingPrice("");
      setIsListingMode(false);
      setTooltipData(null); // Close tooltip
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
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">
              Inventory
            </h2>
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

              {loading ? (
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
            <div className="text-xs text-white/70 mb-3">Hover vào ô có đồ để xem thông tin.</div>

            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${SLOTS_PER_ROW}, 2rem)` }}>
              {Array.from({ length: totalSlots }).map((_, idx) => {
                const entry = entries[idx] ?? null;

                if (!entry) {
                  return <div key={`empty-${idx}`} className="w-8 h-8 bg-[#0d1117] border border-[#4deeac] rounded" />;
                }

                const isItem = entry.kind === "item";
                const slotId = entry.id;
                const slotImg = isItem
                  ? getItemImageUrl(entry.item.item_type, entry.item.rarity)
                  : getBlueprintImageUrl();

                const title = isItem ? entry.item.name : "Blueprint";

                return (
                  <div
                    key={slotId}
                    className="relative group cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnter(entry, e)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="w-8 h-8 bg-[#0d1117] border border-[#4deeac] rounded overflow-hidden">
                      <img src={slotImg} alt={title} className="w-8 h-8 object-cover" draggable={false} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tooltipData &&
          createPortal(
            (() => {
              const { entry, rect } = tooltipData;
              const isItem = entry.kind === "item";
              const title = isItem ? entry.item.name : "Blueprint";

              const canUse =
                isItem &&
                isConsumable(entry.item.item_type) &&
                !!selectedNpc &&
                (entry.item.item_type === ITEM_TYPES.REVIVAL_POTION
                  ? selectedNpc.status === NPC_STATUS.KNOCKED
                  : selectedNpc.status !== NPC_STATUS.KNOCKED);

              const useDisabled =
                !canUse || !!actionLoadingItemId || (isItem && actionLoadingItemId === entry.item.id);

              const style: React.CSSProperties = {
                top: rect.top - 8,
                left: rect.left + rect.width / 2,
                transform: "translate(-50%, -100%)",
                position: "fixed",
                zIndex: 9999,
              };

              return (
                <div
                  style={style}
                  className="pointer-events-auto"
                  onMouseEnter={handleTooltipEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="w-64 bg-[#1a1f2e] border-2 border-[#4deeac] rounded-lg p-3 shadow-[0_0_20px_rgba(77,238,172,0.35)] animate-fadeIn">
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

                        {entry.item.durability !== undefined ? (
                          <div>
                            <span className="text-[#4deeac]">Rating:</span> {getItemRating(entry.item)}
                          </div>
                        ) : null}

                        {entry.item.durability !== undefined ? (
                          <div>
                            <span className="text-[#4deeac]">Repair Cost (Scrap):</span> {getEstimatedRepairScrapCost(entry.item) ?? "-"}
                          </div>
                        ) : null}

                        {entry.item.durability !== undefined && !isConsumable(entry.item.item_type) ? (
                          <div className="pt-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!bunkerId) {
                                  alert("Missing bunker. Please create a bunker first.");
                                  return;
                                }
                                void handleRepairItem(entry.item);
                              }}
                              disabled={
                                !bunkerId ||
                                !!actionLoadingItemId ||
                                entry.item.durability >= (entry.item.max_durability ?? 0)
                              }
                              className={`w-full px-3 py-2 rounded text-xs font-bold transition-all ${
                                !bunkerId ||
                                !!actionLoadingItemId ||
                                entry.item.durability >= (entry.item.max_durability ?? 0)
                                  ? "bg-gray-700 text-gray-300 cursor-not-allowed"
                                  : "bg-[#4deeac] text-[#0d1117] hover:bg-[#5fffc0]"
                              }`}
                              title={!bunkerId ? "Create a bunker first" : ""}
                            >
                              {actionLoadingItemId === entry.item.id ? "Repairing..." : "Repair"}
                            </button>
                          </div>
                        ) : null}

                        {entry.item.item_type === ITEM_TYPES.CLOTH ? (
                          <div className="pt-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!bunkerId) {
                                  alert("Missing bunker. Please create a bunker first.");
                                  return;
                                }
                                void handleCraftBandageFromCloth(entry.item);
                              }}
                              disabled={!bunkerId || !!actionLoadingItemId}
                              className={`w-full px-3 py-2 rounded text-xs font-bold transition-all ${
                                !bunkerId || !!actionLoadingItemId
                                  ? "bg-gray-700 text-gray-300 cursor-not-allowed"
                                  : "bg-[#4deeac] text-[#0d1117] hover:bg-[#5fffc0]"
                              }`}
                            >
                              {actionLoadingItemId === entry.item.id ? "Crafting..." : "Craft Bandage"}
                            </button>
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

                    {/* List Button for Items */}
                    {isItem && (
                      <div className="pt-2 border-t border-white/10 mt-2">
                        {isListingMode && actionLoadingItemId === entry.item.id ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              placeholder="Price (SUI)"
                              value={listingPrice}
                              onChange={(e) => setListingPrice(e.target.value)}
                              className="bg-[#0d1117] text-white text-xs p-1 border border-[#4deeac] rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleListCallback(entry.item);
                                }}
                                className="flex-1 bg-[#4deeac] text-[#0d1117] text-xs font-bold py-1 rounded hover:bg-[#5fffc0]"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsListingMode(false);
                                  setActionLoadingItemId(null);
                                }}
                                className="flex-1 bg-red-500 text-white text-xs font-bold py-1 rounded hover:bg-red-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsListingMode(true);
                              setActionLoadingItemId(entry.item.id);
                            }}
                            className="w-full bg-yellow-500 text-[#0d1117] text-xs font-bold py-1 rounded hover:bg-yellow-400 mb-1"
                          >
                            List on Market
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })(),
            document.body
          )}
      </div>
    </div>
  );
}
