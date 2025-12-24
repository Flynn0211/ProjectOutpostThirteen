import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import { Item } from "../types";
import { getItemImageUrl } from "../utils/imageUtils";
import { ITEM_TYPES, RARITY_NAMES } from "../constants";

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const account = useCurrentAccount();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !account) return;

    async function loadItems() {
      setLoading(true);
      try {
        const itemObjects = await getOwnedObjects(
          account.address,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Inventory</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
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
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
              >
                <img
                  src={getItemImageUrl(item.item_type, item.rarity)}
                  alt={item.name}
                  className="w-full h-32 object-cover rounded mb-2"
                />
                <div className="text-white text-sm">
                  <div className="font-bold truncate">{item.name}</div>
                  <div className="text-xs text-gray-300">
                    {RARITY_NAMES[item.rarity as keyof typeof RARITY_NAMES]}
                  </div>
                  {item.durability !== undefined && (
                    <div className="text-xs text-gray-400 mt-1">
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

