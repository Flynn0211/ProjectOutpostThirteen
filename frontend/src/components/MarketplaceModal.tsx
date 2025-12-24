import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Item, NPC } from "../types";
import { getItemImageUrl, getNPCSpriteUrl } from "../utils/imageUtils";
import { RARITY_NAMES } from "../constants";

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MarketTab = "items" | "npcs" | "resources";

export function MarketplaceModal({ isOpen, onClose }: MarketplaceModalProps) {
  const [activeTab, setActiveTab] = useState<MarketTab>("items");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadListings() {
      setLoading(true);
      try {
        // TODO: Fetch marketplace listings from contract
        // For now, empty array
        setListings([]);
      } catch (error) {
        console.error("Error loading listings:", error);
      } finally {
        setLoading(false);
      }
    }

    loadListings();
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-6xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Marketplace</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab("items")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "items"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Items
          </button>
          <button
            onClick={() => setActiveTab("npcs")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "npcs"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            NPCs
          </button>
          <button
            onClick={() => setActiveTab("resources")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "resources"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Resources
          </button>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="text-white text-center py-8">Loading listings...</div>
        ) : listings.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No listings available</div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
              >
                <div className="text-white">
                  <div className="font-bold">Price: {listing.price / 1e9} SUI</div>
                  <button className="mt-2 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

