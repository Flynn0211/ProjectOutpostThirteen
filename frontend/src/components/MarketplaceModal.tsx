import { useState, useEffect } from "react";
import { IMAGES } from "../constants";
import { SpriteSheet } from "./SpriteSheet";

import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { useMarketplace, type Listing } from "../hooks/useMarketplace";
import { useOwnedBunkers } from "../query/ownedQueries";
import { useInventory } from "../hooks/useInventory";

import { getItemImageUrl } from "../utils/imageUtils";
import { BASE_PRICES } from "../constants";

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MarketTab = "market" | "resources" | "my-listings" | "sell";

export function MarketplaceModal({ isOpen, onClose }: MarketplaceModalProps) {
  const [activeTab, setActiveTab] = useState<MarketTab>("market");
  const [marketFilter, setMarketFilter] = useState<"item" | "npc" | "resource">("item");
  const [sellFilter, setSellFilter] = useState<"item" | "npc">("item");
  
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedBunkerId, setSelectedBunkerId] = useState<string>("");
  
  const { fetchListings, buyItem, buyNPC, buyBundle, delistItem, delistNPC, batchList, loading } = useMarketplace();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const account = useCurrentAccount();

  const { data: bunkers } = useOwnedBunkers(account?.address ?? "");

  // Batch Selection State: Map<ID, Price>
  // If ID is in map, it is selected. Value is price input.
  const [selectedItems, setSelectedItems] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (bunkers && bunkers.length > 0 && !selectedBunkerId) {
      setSelectedBunkerId((bunkers[0] as any).id);
    }
  }, [bunkers, selectedBunkerId]);

  // Clear selections when tab/filter changes
  useEffect(() => {
      setSelectedItems(new Map());
  }, [activeTab, sellFilter, marketFilter]);

  // Fetch Listings based on activeTab and marketFilter
  useEffect(() => {
    if (!isOpen) return;

    async function load() {
      let type: "item" | "npc" | "bundle" = "item";
      
      if (activeTab === "market") {
          if (marketFilter === "resource") type = "bundle";
          else type = marketFilter;
      } else if (activeTab === "my-listings") {
          if (marketFilter === "resource") type = "bundle";
          else type = marketFilter;
      } else {
          return; // Sell tab doesn't fetch listings
      }

      const data = await fetchListings(type);
      setListings(data);
    }

    load();
  }, [isOpen, activeTab, marketFilter, fetchListings]);

  // Inventory logic for Sell Tab
  // Using shared hook for inventory management
  const { items: inventoryItems, npcs: inventoryNPCs, loading: loadingInventory, refresh: refreshInventory } = useInventory(isOpen && activeTab === "sell");

  const toggleSelection = (id: string, currentPrice: string = "") => {
      const newMap = new Map(selectedItems);
      if (newMap.has(id)) {
          newMap.delete(id);
      } else {
          newMap.set(id, currentPrice);
      }
      setSelectedItems(newMap);
  };

  const updatePrice = (id: string, price: string) => {
      if (!selectedItems.has(id)) return;
      const newMap = new Map(selectedItems);
      newMap.set(id, price);
      setSelectedItems(newMap);
  };

  const handleBatchList = async () => {
      if (selectedItems.size === 0) return;

      const itemsToList: { id: string; price: string; type: "item" | "npc" }[] = [];
      let error = false;

      selectedItems.forEach((price, id) => {
          if (!price || isNaN(Number(price)) || Number(price) <= 0) {
              error = true;
          }
          // Convert SUI to MIST
          const priceInMist = Math.floor(Number(price) * 1_000_000_000).toString();
          itemsToList.push({
              id,
              price: priceInMist,
              type: sellFilter
          });
      });

      if (error) {
          alert("Please enter valid prices (SUI) for all selected items.");
          return;
      }

      try {
          await batchList(itemsToList, signAndExecute);
          alert(`listed ${itemsToList.length} items successfully!`);
          
          setSelectedItems(new Map()); // Clear selection

          // Refresh inventory
          refreshInventory();
      } catch(e) {
          console.error(e);
          alert("Batch listing failed");
      }
  };

  const handleBuy = async (listing: Listing) => {
    if (!account) return alert("Please connect wallet");
    
    try {
      if (listing.type === "item") {
        await buyItem(listing.id, listing.price, signAndExecute);
      } else if (listing.type === "npc") {
        await buyNPC(listing.id, listing.price, signAndExecute);
      } else if (listing.type === "bundle") {
         if (!selectedBunkerId) {
            alert("No bunker selected. You need a bunker to receive resources.");
            return;
         }
         await buyBundle(listing.id, listing.price, selectedBunkerId, signAndExecute);
      }
      // Refresh
      if (activeTab === "market" || activeTab === "my-listings") {
          const t = marketFilter === "resource" ? "bundle" : marketFilter;
          const data = await fetchListings(t);
          setListings(data);
      }
    } catch (e) {
      console.error(e);
      alert("Purchase failed");
    }
  };

  const handleDelist = async (listing: Listing) => {
    if (!account) return;
    try {
      if (listing.type === "item") {
        await delistItem(listing.id, signAndExecute);
      } else if (listing.type === "npc") {
        await delistNPC(listing.id, signAndExecute);
      }
      // Refresh
      if (activeTab === "market" || activeTab === "my-listings") {
          const t = marketFilter === "resource" ? "bundle" : marketFilter;
          const data = await fetchListings(t);
          setListings(data);
      }
    } catch (e) {
      console.error(e);
      alert("Delist failed");
    }
  };

  const filteredListings = activeTab === "my-listings" 
    ? listings.filter((l: Listing) => account && l.seller === account.address)
    : listings; 

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-6xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        
        {/* ... Header ... */}

        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer pointer-events-none" />

        <div className="relative z-10 flex justify-between items-center mb-6 shrink-0">
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

        {/* Main Tabs */}
        <div className="relative z-10 flex gap-4 mb-4 border-b-2 border-[#4deeac]/30 items-center pb-2 shrink-0">
           <button
            onClick={() => setActiveTab("market")}
            className={`px-6 py-2 font-bold uppercase tracking-wider transition-all rounded-t-lg ${
              activeTab === "market"
                ? "bg-[#4deeac]/10 text-[#4deeac] border-b-2 border-[#4deeac]"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setActiveTab("sell")}
            className={`px-6 py-2 font-bold uppercase tracking-wider transition-all rounded-t-lg ${
              activeTab === "sell"
                ? "bg-[#4deeac]/10 text-[#4deeac] border-b-2 border-[#4deeac]"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Sell
          </button>

          {account && (
            <button
              onClick={() => setActiveTab("my-listings")}
              className={`px-6 py-2 font-bold uppercase tracking-wider transition-all rounded-t-lg ml-auto ${
                activeTab === "my-listings"
                  ? "bg-[#4deeac]/10 text-[#4deeac] border-b-2 border-[#4deeac]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              My Listings
            </button>
          )}
        </div>

        {/* Sub-filters for Market & My Listings */}
        {(activeTab === "market" || activeTab === "my-listings") && (
            <div className="relative z-10 flex gap-2 mb-4 shrink-0">
                <button
                    onClick={() => setMarketFilter("item")}
                    className={`px-3 py-1 text-sm font-bold uppercase border rounded transition-all ${
                    marketFilter === "item" ? "bg-[#4deeac] text-black border-[#4deeac]" : "text-[#4deeac] border-[#4deeac] hover:bg-[#4deeac]/20"
                    }`}
                >
                    Items
                </button>
                <button
                    onClick={() => setMarketFilter("npc")}
                    className={`px-3 py-1 text-sm font-bold uppercase border rounded transition-all ${
                    marketFilter === "npc" ? "bg-[#4deeac] text-black border-[#4deeac]" : "text-[#4deeac] border-[#4deeac] hover:bg-[#4deeac]/20"
                    }`}
                >
                    NPCs
                </button>
                <button
                    onClick={() => setMarketFilter("resource")}
                    className={`px-3 py-1 text-sm font-bold uppercase border rounded transition-all ${
                    marketFilter === "resource" ? "bg-[#4deeac] text-black border-[#4deeac]" : "text-[#4deeac] border-[#4deeac] hover:bg-[#4deeac]/20"
                    }`}
                >
                    Resources
                </button>
                
                {marketFilter === "resource" && bunkers && bunkers.length > 0 && activeTab !== "my-listings" && (
                     <div className="ml-auto flex items-center gap-2">
                        <span className="text-sm text-[#4deeac]">Target Bunker:</span>
                        <select 
                          value={selectedBunkerId} 
                          onChange={(e) => setSelectedBunkerId(e.target.value)}
                          className="bg-[#0d1117] text-white border border-[#4deeac] rounded px-2 py-1 text-sm focus:outline-none"
                        >
                          {bunkers.map((b) => (
                            <option key={(b as any).id} value={(b as any).id}>
                              {(b as any).name || "Bunker"} ({(b as any).id.slice(0, 6)}...)
                            </option>
                          ))}
                        </select>
                     </div>
                )}
            </div>
        )}

        {/* Sub-filters for Sell Tab */}
        {activeTab === "sell" && (
            <div className="relative z-10 flex gap-2 mb-4 shrink-0">
                <button
                    onClick={() => setSellFilter("item")}
                    className={`px-3 py-1 text-sm font-bold uppercase border rounded transition-all ${
                    sellFilter === "item" ? "bg-[#4deeac] text-black border-[#4deeac]" : "text-[#4deeac] border-[#4deeac] hover:bg-[#4deeac]/20"
                    }`}
                >
                    Sell Items
                </button>
                <button
                    onClick={() => setSellFilter("npc")}
                    className={`px-3 py-1 text-sm font-bold uppercase border rounded transition-all ${
                    sellFilter === "npc" ? "bg-[#4deeac] text-black border-[#4deeac]" : "text-[#4deeac] border-[#4deeac] hover:bg-[#4deeac]/20"
                    }`}
                >
                    Sell NPCs
                </button>
            </div>
        )}

        {/* Content Wrapper for scrolling */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 relative custom-scrollbar">
            {/* Sell Tab Content */}
            {activeTab === "sell" ? (
                <div className="pb-4">
                    <div className="text-[#4deeac] mb-4 text-sm">
                        {sellFilter === "item" 
                            ? "Select items to list. Set price for each item." 
                            : "Select NPCs from your bunker to list."}
                    </div>
                    
                    {loadingInventory ? (
                        <div className="text-white text-center">Loading inventory...</div>
                    ) : (
                        <div className="grid grid-cols-5 gap-4">
                            {sellFilter === "item" && inventoryItems.length === 0 && (
                                <div className="col-span-5 text-gray-400 text-center">No items found.</div>
                            )}
                            {sellFilter === "npc" && inventoryNPCs.length === 0 && (
                                <div className="col-span-5 text-gray-400 text-center">No NPCs found available.</div>
                            )}

                            {sellFilter === "item" && inventoryItems.map((item) => {
                                const isSelected = selectedItems.has(item.id);
                                const price = selectedItems.get(item.id) || "";
                                const suggested = (BASE_PRICES[item.rarity as keyof typeof BASE_PRICES] / 1e9).toFixed(1);

                                return (
                                <div 
                                    key={item.id} 
                                    onClick={() => !isSelected && toggleSelection(item.id)}
                                    className={`bg-[#0d1117] border rounded-lg p-3 flex flex-col items-center cursor-pointer transition-all hover:bg-[#4deeac]/10 ${
                                        isSelected ? "border-[#4deeac] ring-2 ring-[#4deeac]" : "border-gray-700"
                                    }`}
                                >
                                    <img src={getItemImageUrl(item.item_type, item.rarity)} className="w-16 h-16 object-contain mb-2" />
                                    <div className="text-white text-xs font-bold truncate w-full text-center mb-2">{item.name}</div>
                                    
                                    {isSelected ? (
                                        <div className="w-full animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                            <div className="text-[10px] text-gray-400 mb-1 text-center">
                                                Suggested: {suggested} SUI
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Price (SUI)"
                                                autoFocus 
                                                value={price}
                                                onChange={(e) => updatePrice(item.id, e.target.value)}
                                                className="w-full bg-gray-800 text-white text-xs p-1 mb-1 rounded border border-[#4deeac]"
                                            />
                                            <button 
                                                onClick={() => toggleSelection(item.id)}
                                                className="w-full bg-red-500/80 hover:bg-red-500 text-white text-[10px] rounded py-1 mt-1"
                                            >
                                                Unselect
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 mt-auto">Click to Select</div>
                                    )}
                                </div>
                            )})}

                            {sellFilter === "npc" && inventoryNPCs.map((npc) => {
                                const isSelected = selectedItems.has(npc.id);
                                const price = selectedItems.get(npc.id) || "";
                                const suggested = (BASE_PRICES[2] / 1e9).toFixed(1); // Default NPC suggestion

                                return (
                                <div 
                                    key={npc.id} 
                                    onClick={() => !isSelected && toggleSelection(npc.id)}
                                    className={`bg-[#0d1117] border rounded-lg p-3 flex flex-col items-center min-h-[220px] justify-between cursor-pointer transition-all hover:bg-[#4deeac]/10 ${
                                        isSelected ? "border-[#4deeac] ring-2 ring-[#4deeac]" : "border-gray-700"
                                    }`}
                                >
                                    <div className="w-full flex justify-center mb-2 overflow-hidden h-24 items-center">
                                        <div style={{ transform: "scale(0.75)" }}>
                                            <SpriteSheet src={IMAGES.npc[0]} frameWidth={128} frameHeight={128} fps={12} playing={true} /> 
                                        </div>
                                    </div>
                                    <div className="text-white text-xs font-bold truncate w-full text-center mb-1">{npc.name}</div>
                                    <div className="text-[#4deeac] text-[10px] mb-2">Lvl {npc.level}</div>
                                    
                                    {isSelected ? (
                                        <div className="w-full animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                            <div className="text-[10px] text-gray-400 mb-1 text-center">
                                                Suggested: {suggested} SUI
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Price (SUI)"
                                                autoFocus 
                                                value={price}
                                                onChange={(e) => updatePrice(npc.id, e.target.value)}
                                                className="w-full bg-gray-800 text-white text-xs p-1 mb-1 rounded border border-[#4deeac]"
                                            />
                                            <button 
                                                onClick={() => toggleSelection(npc.id)}
                                                className="w-full bg-red-500/80 hover:bg-red-500 text-white text-[10px] rounded py-1 mt-1"
                                            >
                                                Unselect
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 mt-auto">Click to Select</div>
                                    )}
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            ) : (
            /* Listings */
            loading ? (
            <div className="text-white text-center py-8">
                Loading {marketFilter === "resource" ? "bundles" : marketFilter + "s"}...
            </div>
            ) : listings.length === 0 ? (
            <div>
                <div className="text-gray-400 text-center py-4">No listings found</div>
            </div>
            ) : (
            <div className="grid grid-cols-4 gap-4">
                {filteredListings.map((listing) => (
                <div
                    key={listing.id}
                    className="bg-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4 hover:shadow-[0_0_15px_rgba(77,238,172,0.4)] transition-all flex flex-col justify-between"
                >
                    <div>
                    <div className="w-full h-32 bg-black/40 rounded mb-2 flex items-center justify-center p-2 mb-4 overflow-hidden relative">
                        {listing.type === "item" && (
                            <img 
                                src={listing.details ? getItemImageUrl(listing.details.item_type, listing.details.rarity) : IMAGES.weapon[0]} 
                                className="h-full object-contain"
                            />
                        )}
                        
                        {listing.type === "npc" && (
                            <div className="w-full h-full flex items-center justify-center">
                                <div style={{ transform: "scale(0.8)" }}>
                                    <SpriteSheet src={IMAGES.npc[0]} frameWidth={128} frameHeight={128} fps={12} playing={true} />
                                </div>
                            </div>
                        )}
                        {listing.type === "bundle" && <img src={IMAGES.room[5]} className="h-full object-contain"/>}
                    </div>
                    <div className="text-white font-bold text-center mb-2 truncate">
                        {listing.type === "item" ? (listing.details?.name || "Item") : listing.type === "npc" ? (listing.details?.name || "NPC") : "Bundle"}
                    </div>
                    <div className="text-xs text-gray-400 text-center">
                            #{listing.id.slice(0,4)}...
                    </div>
                    </div>
                    
                    <div className="text-white mt-2">
                    <div className="font-bold text-[#4deeac] text-center mb-2">
                        {(Number(listing.price) / 1_000_000_000).toFixed(2)} SUI
                    </div>
                    {activeTab === "my-listings" ? (
                        <button 
                        onClick={() => handleDelist(listing)}
                        className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold"
                        >
                        Delist
                        </button>
                    ) : (
                        <button 
                        onClick={() => handleBuy(listing)}
                        className="w-full px-4 py-2 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] text-[#0d1117] rounded-lg font-bold"
                        >
                        Buy
                        </button>
                    )}
                    </div>
                </div>
                ))}
            </div>
            )
        )}
        </div>

        {/* Footer Batch Action Bar */}
        {selectedItems.size > 0 && activeTab === "sell" && (
             <div className="mt-auto border-t border-[#4deeac]/30 bg-[#0d1117]/95 p-4 flex items-center justify-between shrink-0 z-20 backdrop-blur-sm animate-slideUp">
                  <div className="text-white text-sm font-bold flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#4deeac] rounded-full animate-pulse"/>
                      {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''} Selected
                  </div>
                  <div className="flex items-center gap-3">
                       <button
                          onClick={() => setSelectedItems(new Map())}
                          className="px-4 py-1.5 text-xs font-bold text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded transition-all"
                       >
                          Clear
                       </button>
                       <button
                          onClick={handleBatchList}
                          className="bg-[#4deeac] hover:bg-[#5fffc0] text-black text-sm font-bold px-8 py-2 rounded shadow-[0_0_15px_rgba(77,238,172,0.5)] transition-all transform hover:scale-105 active:scale-95"
                       >
                          List Selected Items
                       </button>
                  </div>
             </div>
        )}
      </div>
    </div>
  );
}

