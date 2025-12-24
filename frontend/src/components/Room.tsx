import { useState } from "react";
import { Room as RoomType } from "../types";
import { getRoomImageUrl } from "../utils/imageUtils";
import { ROOM_TYPE_NAMES } from "../constants";
import { NPCComponent } from "./NPC";
import { AssignNPCModal } from "./AssignNPCModal";

interface RoomProps {
  room: RoomType;
  roomIndex: number;
  npcs: any[];
  bunkerId?: string;
}

export function RoomComponent({ room, roomIndex, npcs, bunkerId }: RoomProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const roomImageUrl = getRoomImageUrl(room.room_type);
  const roomName = ROOM_TYPE_NAMES[room.room_type as keyof typeof ROOM_TYPE_NAMES] || "Unknown";

  return (
    <>
      <div
        className="relative w-64 h-64 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
        onClick={() => bunkerId && setShowAssignModal(true)}
      >
        {/* Room image */}
        <img
          src={roomImageUrl}
          alt={roomName}
          className="w-full h-full object-cover"
        />
        
        {/* Room info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-white text-xs">
          <div className="font-bold">{roomName}</div>
          <div>Level {room.level}</div>
          <div>{room.assigned_npcs}/{room.capacity} NPCs</div>
        </div>

        {/* NPCs in room */}
        <div className="absolute inset-0 pointer-events-none">
          {npcs.map((npc, index) => (
            <NPCComponent
              key={npc.id}
              npc={npc}
              position={{ x: 50 + (index * 60), y: 100 }}
              isWalking={room.assigned_npcs > 0}
            />
          ))}
        </div>
      </div>

      {bunkerId && (
        <AssignNPCModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          room={room}
          roomIndex={roomIndex}
          bunkerId={bunkerId}
          onSuccess={() => {
            // Reload will be handled by parent
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

