import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import type { Bunker } from "../types";
import { IMAGES } from "../constants";
import { RoomComponent } from "./Room";
import { CreateBunkerModal } from "./CreateBunkerModal";
import { ResourcesBar } from "./ResourcesBar";
import { AddRoomButton } from "./AddRoomButton";

interface BunkerViewProps {
  onBunkerLoaded?: (bunkerId: string) => void;
  refreshTick?: number;
}

export function BunkerView({ onBunkerLoaded, refreshTick }: BunkerViewProps) {
  const account = useCurrentAccount();
  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [npcs, setNpcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadBunkerData = async () => {
    if (!account?.address) return;
    
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
  };

  useEffect(() => {
    loadBunkerData();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadBunkerData, 5000);
    return () => clearInterval(interval);
  }, [account]);

  // Trigger refresh when parent signals
  useEffect(() => {
    if (refreshTick !== undefined) {
      loadBunkerData();
    }
  }, [refreshTick]);

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
            setShowCreateModal(false);
            loadBunkerData();
          }}
        />
      </>
    );
  }

  const rooms = bunker.rooms || [];

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Sky / surface layer */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${IMAGES.background})` }}
      />
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

      {/* Resources bar centered top */}
      <ResourcesBar bunker={bunker} />

      {/* Bunker grid - 3 rooms per row */}
      <div className="absolute top-28 left-0 right-0 bottom-0 px-8 pb-20 overflow-y-auto overflow-x-hidden flex justify-center">
        <div className="relative w-full max-w-[1250px]">
          {/* Ground shadow */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/50 to-transparent" />

          <div className="grid grid-cols-3 gap-6 pt-6 pb-10 justify-items-center">
            {rooms.map((room, roomIndex) => (
              <RoomComponent
                key={roomIndex}
                room={room}
                roomIndex={roomIndex}
                npcs={npcs.filter(npc => npc.assigned_room === roomIndex)}
                bunkerId={bunker.id}
                onRefresh={loadBunkerData}
              />
            ))}

            <div className="flex-shrink-0">
              <AddRoomButton
                bunkerId={bunker.id}
                onSuccess={loadBunkerData}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

