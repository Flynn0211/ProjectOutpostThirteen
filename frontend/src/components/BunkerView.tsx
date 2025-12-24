import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import { Bunker, Room } from "../types";
import { ROOMS_PER_ROW, ROOM_TYPES, ROOM_TYPE_NAMES } from "../constants";
import { getRoomImageUrl } from "../utils/imageUtils";
import { IMAGES } from "../constants";
import { RoomComponent } from "./Room";
import { NPCComponent } from "./NPC";
import { CreateBunkerModal } from "./CreateBunkerModal";

interface BunkerViewProps {
  onBunkerLoaded?: (bunkerId: string) => void;
}

export function BunkerView({ onBunkerLoaded }: BunkerViewProps) {
  const account = useCurrentAccount();
  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [npcs, setNpcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!account) return;

    async function loadBunker() {
      setLoading(true);
      try {
        // Fetch bunker
        const bunkers = await getOwnedObjects(
          account.address,
          getObjectType("bunker", "Bunker")
        );
        
        if (bunkers.length > 0) {
          const bunkerData = bunkers[0] as Bunker;
          setBunker(bunkerData);
          if (onBunkerLoaded && bunkerData.id) {
            onBunkerLoaded(bunkerData.id);
          }
        }

        // Fetch NPCs
        const npcObjects = await getOwnedObjects(
          account.address,
          getObjectType("npc", "NPC")
        );
        setNpcs(npcObjects);
      } catch (error) {
        console.error("Error loading bunker:", error);
      } finally {
        setLoading(false);
      }
    }

    loadBunker();
  }, [account]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading bunker...</div>
      </div>
    );
  }

  if (!bunker) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="text-center">
            <p className="text-white text-xl mb-4">No bunker found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Bunker
            </button>
          </div>
        </div>
        <CreateBunkerModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            // Reload bunker
            if (account) {
              getOwnedObjects(account.address, getObjectType("bunker", "Bunker")).then(
                (bunkers) => {
                  if (bunkers.length > 0) {
                    const bunkerData = bunkers[0] as Bunker;
                    setBunker(bunkerData);
                    if (onBunkerLoaded && bunkerData.id) {
                      onBunkerLoaded(bunkerData.id);
                    }
                  }
                }
              );
            }
          }}
        />
      </>
    );
  }

  // Organize rooms into rows (3 per row, from right to left)
  const rooms = bunker.rooms || [];
  const rows: Room[][] = [];
  for (let i = 0; i < rooms.length; i += ROOMS_PER_ROW) {
    rows.push(rooms.slice(i, i + ROOMS_PER_ROW).reverse()); // Reverse for right-to-left
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${IMAGES.background})` }}
      />
      
      {/* Ground section */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gray-800 to-transparent" />

      {/* Bunker info */}
      <div className="absolute top-4 right-4 z-40 bg-gray-800/90 p-4 rounded-lg text-white">
        <h2 className="text-xl font-bold mb-2">{bunker.name}</h2>
        <div className="text-sm space-y-1">
          <div>Level: {bunker.level}</div>
          <div>Food: {bunker.food}</div>
          <div>Water: {bunker.water}</div>
          <div>Scrap: {bunker.scrap}</div>
          <div>Power: {bunker.power_generation}/{bunker.power_consumption}</div>
        </div>
      </div>

      {/* Rooms grid */}
      <div className="absolute top-32 left-0 right-0 bottom-0 p-8">
        <div className="flex flex-col gap-4 h-full">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 justify-center">
              {row.map((room, roomIndex) => {
                const actualRoomIndex = rooms.length - (rowIndex * ROOMS_PER_ROW + row.length - roomIndex);
                return (
                  <RoomComponent
                    key={`${rowIndex}-${roomIndex}`}
                    room={room}
                    roomIndex={actualRoomIndex}
                    npcs={npcs.filter(npc => npc.assigned_room === actualRoomIndex)}
                    bunkerId={bunker.id}
                  />
                );
              })}
            </div>
          ))}
          
          {/* Add room button */}
          <div className="flex justify-center">
            <button className="w-64 h-64 border-4 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-6xl text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors">
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

