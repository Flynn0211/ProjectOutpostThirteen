import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import type { Item } from "../types";
import { getItemImageUrl } from "../utils/imageUtils";
import { RARITY_NAMES } from "../constants";

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const account = useCurrentAccount();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !account?.address) return;

    async function loadItems() {
      setLoading(true);
      try {
        const itemObjects = await getOwnedObjects(
          account!.address,
          getObjectType("item", "Item")
        );
        setItems(itemObjects as Item[]);
      } catch (error) {
        console.error("Error loading items:", error);
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, [isOpen, account]);

  if (!isOpen) return null;

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

        {loading ? (
          <div className="text-white text-center py-8">Loading items...</div>
        ) : items.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No items in inventory</div>
        ) : (
            <div className="grid grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                    className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4 hover:shadow-[0_0_15px_rgba(77,238,172,0.4)] transition-all cursor-pointer"
              >
                <img
                  src={getItemImageUrl(item.item_type, item.rarity)}
                  alt={item.name}
                  className="w-full h-32 object-cover rounded mb-2"
                />
                <div className="text-white text-sm">
                  <div className="font-bold truncate">{item.name}</div>
                      <div className="text-xs text-[#4deeac]">
                    {RARITY_NAMES[item.rarity as keyof typeof RARITY_NAMES]}
                  </div>
                  {item.durability !== undefined && (
                        <div className="text-xs text-white/70 mt-1">
                      Durability: {item.durability}/{item.max_durability}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

