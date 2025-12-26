import { useState, useEffect } from "react";
import { suiClient, parseObjectData } from "../utils/sui";
import type { NPC, Item } from "../types";
import { getNPCSpriteUrl, getItemImageUrl } from "../utils/imageUtils";
import { NPC_STATUS } from "../constants";

const EQUIPMENT_SLOTS = ["slot_weapon", "slot_armor", "slot_tool_1", "slot_tool_2"];

interface NpcListWithEquipmentProps {
    npcs: NPC[];
    selectedNpcId: string;
    onSelect: (id: string) => void;
}

export function NpcListWithEquipment({ npcs, selectedNpcId, onSelect }: NpcListWithEquipmentProps) {
    const [equipmentMap, setEquipmentMap] = useState<Record<string, Item[]>>({});

    useEffect(() => {
        let mounted = true;

        async function fetchChunk(chunk: NPC[]) {
            const chunkResults: Record<string, Item[]> = {};
            
            await Promise.all(chunk.map(async (npc) => {
                if (!mounted) return;
                try {
                    const fields = await suiClient.getDynamicFields({ parentId: npc.id });
                    const slots: string[] = [];
                    
                    fields.data.forEach(field => {
                        let name = String(field.name.value);
                        if (field.name.type === 'vector<u8>' && Array.isArray(field.name.value)) {
                            name = new TextDecoder().decode(new Uint8Array(field.name.value as number[]));
                        }
                        
                        if (EQUIPMENT_SLOTS.includes(name)) {
                            slots.push(field.objectId);
                        }
                    });

                    if (slots.length > 0) {
                        const itemObjects = await suiClient.multiGetObjects({ 
                            ids: slots, 
                            options: { showContent: true, showType: true } 
                        });
                        
                        const items = itemObjects.map(resp => parseObjectData(resp) as Item).filter(i => !!i);
                        chunkResults[npc.id] = items;
                    } else {
                        chunkResults[npc.id] = [];
                    }
                } catch (e) {
                    console.warn(`Failed to fetch equipment for NPC ${npc.id}`, e);
                    chunkResults[npc.id] = [];
                }
            }));

            return chunkResults;
        }

        async function fetchAllInChunks() {
            const CHUNK_SIZE = 4; // Fetch 4 NPCs at a time to avoid rate limits but give progressive updates
            
            for (let i = 0; i < npcs.length; i += CHUNK_SIZE) {
                if (!mounted) break;
                const chunk = npcs.slice(i, i + CHUNK_SIZE);
                
                // Fetch this chunk in parallel
                const results = await fetchChunk(chunk);
                
                if (mounted) {
                    setEquipmentMap(prev => ({
                        ...prev,
                        ...results
                    }));
                }
            }
        }

        if (npcs.length > 0) {
            fetchAllInChunks();
        }

        return () => { mounted = false; };
    }, [npcs]);
    
    // Listen for inventory updates to re-fetch
     useEffect(() => {
        // The parent InventoryModal DOES listen to 'inventory-updated' and refreshes 'npcs', so this component receives new 'npcs' prop and re-runs.
    }, []);


    return (
        <>
            {npcs.map((n) => {
                const equippedItems = equipmentMap[n.id] || [];
                
                return (
                    <div
                          key={n.id}
                          onClick={() => onSelect(n.id)}
                          className={`
                            flex-shrink-0 w-32 p-2 rounded-lg border-2 cursor-pointer transition-all
                            flex flex-col items-center gap-1 relative
                            ${selectedNpcId === n.id 
                                ? "bg-[#4deeac]/20 border-[#4deeac] shadow-[0_0_15px_rgba(77,238,172,0.3)]" 
                                : "bg-[#0d1117] border-gray-700 hover:border-gray-500 hover:bg-gray-800"
                            }
                          `}
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-600 overflow-hidden relative">
                                <div 
                                    className="w-full h-full"
                                    style={{
                                        backgroundImage: `url(${getNPCSpriteUrl(n.rarity, n.profession)})`,
                                        backgroundPosition: '0 0',
                                        backgroundSize: 'auto 100%',
                                        backgroundRepeat: 'no-repeat',
                                        imageRendering: 'pixelated' // Optional: for crisp sprites
                                    }}
                                    title={n.name}
                                />
                            </div>
                            <div className="text-xs font-bold text-white truncate max-w-full">{n.name}</div>
                            
                            {/* Equipment Icons */}
                            <div className="flex justify-center gap-1 min-h-[16px]">
                                {equippedItems.slice(0, 3).map(item => (
                                    <img 
                                        key={item.id} 
                                        src={getItemImageUrl(item.item_type, item.rarity)} 
                                        className="w-4 h-4 object-contain border border-gray-600 rounded bg-black/50" 
                                        title={item.name} 
                                    />
                                ))}
                                {equippedItems.length > 3 && (
                                    <div className="w-4 h-4 text-[8px] flex items-center justify-center text-gray-400 bg-gray-800 rounded border border-gray-600">
                                        +{equippedItems.length - 3}
                                    </div>
                                )}
                            </div>

                            <div className="text-[10px] text-gray-400">Lv {n.level}</div>
                            
                            {/* Status Indicator */}
                             <div className={`
                                text-[9px] px-1.5 py-0.5 rounded-full font-bold
                                ${n.status === NPC_STATUS.IDLE ? "bg-green-500/20 text-green-400" : ""}
                                ${n.status === NPC_STATUS.ON_MISSION ? "bg-blue-500/20 text-blue-400" : ""}
                                ${n.status === NPC_STATUS.KNOCKED ? "bg-red-500/20 text-red-400" : ""}
                                ${n.status === NPC_STATUS.WORKING ? "bg-yellow-500/20 text-yellow-400" : ""}
                            `}>
                                {n.status === NPC_STATUS.IDLE ? "IDLE" : 
                                 n.status === NPC_STATUS.ON_MISSION ? "MISSION" : 
                                 n.status === NPC_STATUS.KNOCKED ? "KNOCKED" : "WORKING"}
                            </div>
                        </div>
                );
            })}
        </>
    );
}
