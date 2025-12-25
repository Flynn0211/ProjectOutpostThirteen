import { useState, useEffect } from "react";
import { IMAGES } from "../constants";
import { SpriteSheet } from "./SpriteSheet";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-6xl w-full max-h-[80vh] overflow-y-auto shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#5fffc0] rounded-tl-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#5fffc0] rounded-br-2xl pointer-events-none" />

        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer pointer-events-none" />

        <div className="relative z-10 flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">Marketplace</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="relative z-10 flex gap-2 mb-4 border-b-2 border-[#4deeac]">
          <button
            onClick={() => setActiveTab("items")}
            className={`px-4 py-3 font-bold uppercase tracking-wider transition-all ${
              activeTab === "items"
                ? "text-[#4deeac] border-b-4 border-[#4deeac]"
                : "text-white/70 hover:text-white"
            }`}
          >
            Items
          </button>
          <button
            onClick={() => setActiveTab("npcs")}
            className={`px-4 py-3 font-bold uppercase tracking-wider transition-all ${
              activeTab === "npcs"
                ? "text-[#4deeac] border-b-4 border-[#4deeac]"
                : "text-white/70 hover:text-white"
            }`}
          >
            NPCs
          </button>
          <button
            onClick={() => setActiveTab("resources")}
            className={`px-4 py-3 font-bold uppercase tracking-wider transition-all ${
              activeTab === "resources"
                ? "text-[#4deeac] border-b-4 border-[#4deeac]"
                : "text-white/70 hover:text-white"
            }`}
          >
            Resources
          </button>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="text-white text-center py-8">Loading listings...</div>
        ) : listings.length === 0 ? (
          <div>
            <div className="text-gray-400 text-center py-4">No listings available — preview samples below</div>

            {activeTab === "items" && (
              <div className="grid grid-cols-4 gap-4">
                {IMAGES.weapon.slice(0, 4).map((src, idx) => (
                  <div key={idx} className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4 text-center hover:shadow-[0_0_15px_rgba(77,238,172,0.4)] transition-all">
                    <div className="w-full h-32 bg-black/40 rounded mb-2 flex items-center justify-center p-2">
                       <img src={src} alt={`weapon-${idx}`} className="w-full h-full object-contain" />
                    </div>
                    <div className="text-white text-sm font-bold">Weapon #{idx + 1}</div>
                    <div className="text-xs text-[#4deeac]">Sample</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "npcs" && (
              <div className="grid grid-cols-4 gap-4">
                {IMAGES.npc.slice(0, 8).map((src, idx) => (
                  <div key={idx} className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4 text-center hover:shadow-[0_0_15px_rgba(77,238,172,0.4)] transition-all">
                    <div className="w-full h-32 bg-[#0d1117] rounded mb-2 overflow-hidden">
                      <div className="w-full h-full flex items-center justify-center">
                        <SpriteSheet src={src} frameWidth={128} frameHeight={128} fps={12} playing={true} />
                      </div>
                    </div>
                    <div className="text-white text-sm font-bold">NPC #{idx + 1}</div>
                    <div className="text-xs text-[#4deeac]">Sample</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "resources" && (
              <div className="grid grid-cols-4 gap-4">
                {IMAGES.room.slice(0, 4).map((src, idx) => (
                  <div key={idx} className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4 text-center hover:shadow-[0_0_15px_rgba(77,238,172,0.4)] transition-all">
                    <div className="w-full h-32 bg-black/40 rounded mb-2 flex items-center justify-center p-2">
                      <img src={src} alt={`resource-${idx}`} className="w-full h-full object-contain" />
                    </div>
                    <div className="text-white text-sm font-bold">Resource #{idx + 1}</div>
                    <div className="text-xs text-[#4deeac]">Sample</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4 hover:shadow-[0_0_15px_rgba(77,238,172,0.4)] transition-all"
              >
                <div className="text-white">
                  <div className="font-bold">Price: {listing.price / 1e9} SUI</div>
                  <button className="mt-2 w-full px-4 py-2 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] text-[#0d1117] rounded-lg font-bold">
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

