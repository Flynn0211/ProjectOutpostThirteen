import { useState } from "react";
import type { Room as RoomType } from "../types";
import { getRoomImageUrl } from "../utils/imageUtils";
import { ROOM_TYPE_NAMES } from "../constants";
import { NPCComponent } from "./NPC";
import { AssignNPCModal } from "./AssignNPCModal";
import { useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { NPC_STATUS, PACKAGE_ID } from "../constants";

interface RoomProps {
  room: RoomType;
  roomIndex: number;
  npcs: any[];
  bunkerId?: string;
  onRefresh?: () => void;
}

export function RoomComponent({ room, roomIndex, npcs, bunkerId, onRefresh }: RoomProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const roomImageUrl = getRoomImageUrl(room.room_type);
  const roomName = ROOM_TYPE_NAMES[room.room_type as keyof typeof ROOM_TYPE_NAMES] || "Unknown";

  const workers = Number(room.assigned_npcs ?? 0);

  const formatRatePerHour = (amount: number) => `${amount}/h`;
  const getUsesAndProduces = () => {
    const uses: string[] = [];
    const produces: string[] = [];

    switch (room.room_type) {
      case 0: {
        // Living Quarters: increases bunker capacity passively
        uses.push("None");
        produces.push(`Capacity +${room.capacity}`);
        break;
      }
      case 1: {
        // Generator: produces power, also consumes some power per worker
        if (workers > 0) {
          const produced = 30 * workers;
          const consumed = 5 * workers;
          uses.push(`Power -${formatRatePerHour(consumed)}`);
          produces.push(`Power +${formatRatePerHour(produced)} (net +${formatRatePerHour(produced - consumed)})`);
        } else {
          uses.push("None (no workers)");
          produces.push("None (no workers)");
        }
        break;
      }
      case 2: {
        // Farm: consumes power, produces food
        if (workers > 0) {
          const consumed = 5 * workers;
          const produced = Math.floor((room.production_rate * workers * room.efficiency) / 100);
          uses.push(`Power -${formatRatePerHour(consumed)}`);
          produces.push(`Food +${formatRatePerHour(produced)}`);
        } else {
          uses.push("None (no workers)");
          produces.push("None (no workers)");
        }
        break;
      }
      case 3: {
        // Water Pump: consumes power, produces water
        if (workers > 0) {
          const consumed = 10 * workers;
          const produced = Math.floor((room.production_rate * workers * room.efficiency) / 100);
          uses.push(`Power -${formatRatePerHour(consumed)}`);
          produces.push(`Water +${formatRatePerHour(produced)}`);
        } else {
          uses.push("None (no workers)");
          produces.push("None (no workers)");
        }
        break;
      }
      case 4: {
        // Workshop: consumes power, produces scrap
        if (workers > 0) {
          const consumed = 15 * workers;
          const produced = Math.floor((room.production_rate * workers * room.efficiency) / 100);
          uses.push(`Power -${formatRatePerHour(consumed)}`);
          produces.push(`Scrap +${formatRatePerHour(produced)}`);
        } else {
          uses.push("None (no workers)");
          produces.push("None (no workers)");
        }
        break;
      }
      case 5: {
        // Storage: reduces total bunker power consumption passively
        uses.push("None");
        produces.push(`Power use -${2 * room.level} (passive)`);
        break;
      }
      default: {
        uses.push("Unknown");
        produces.push("Unknown");
      }
    }

    return {
      usesText: uses.join(", "),
      producesText: produces.join(", "),
    };
  };

  const { usesText, producesText } = getUsesAndProduces();

  const ROOM_WIDTH = 384;
  const ROOM_HEIGHT = 192;
  const NPC_FRAME = 128;
  const NPC_SCALE = 0.85;
  // Reserve vertical space for the bottom room info overlay so NPCs never overlap it.
  // (Matches the visual height of the bottom info tab area.)
  const ROOM_INFO_OVERLAY_HEIGHT = 64;
  const npcDisplayWidth = NPC_FRAME * NPC_SCALE;
  const npcDisplayHeight = NPC_FRAME * NPC_SCALE;
  const npcAvailableHeight = Math.max(0, ROOM_HEIGHT - ROOM_INFO_OVERLAY_HEIGHT);
  const npcY = Math.max(0, (npcAvailableHeight - npcDisplayHeight) / 2);

  const canCollect = bunkerId && (room.room_type === 2 || room.room_type === 3); // FARM or WATER_PUMP

  const handleCollect = async () => {
    if (!bunkerId) return;
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::bunker::collect_production`,
        arguments: [
          tx.object(bunkerId),
          tx.pure(roomIndex, "u64"),
          tx.object("0x6"), // Clock
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            if (onRefresh) onRefresh();
          },
          onError: (error: any) => {
            alert("Collect failed: " + error.message);
          },
        }
      );
    } catch (error: any) {
      alert("Collect failed: " + error.message);
    }
  };

  return (
    <>
      <div
        className="relative flex-shrink-0 rounded-xl overflow-hidden border-3 border-[#4deeac] bg-[#2a3447] cursor-pointer transition-all shadow-[0_0_20px_rgba(77,238,172,0.3)] hover:border-[#5fffc0] hover:shadow-[0_0_30px_rgba(77,238,172,0.6)]"
        style={{ width: "384px", height: "192px" }}
        onClick={() => bunkerId && setShowAssignModal(true)}
      >
        {/* Room image */}
        <img
          src={roomImageUrl}
          alt={roomName}
          className="w-full h-full object-cover brightness-110 contrast-105"
        />
        
        {/* Light overlay instead of dark */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1f2e]/80 via-transparent to-transparent" />

        {/* Room info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <div className="bg-[#2a3447] border-2 border-[#4deeac] rounded-lg px-3 py-2 text-white text-xs flex items-center justify-between gap-2 shadow-[0_0_10px_rgba(77,238,172,0.4)]">
            <div>
              <div className="font-bold text-sm leading-tight text-[#4deeac]">{roomName}</div>
              <div className="text-[11px] text-white">Level {room.level}</div>
              <div className="text-[10px] text-white/90 leading-tight">Uses: {usesText}</div>
              <div className="text-[10px] text-white/90 leading-tight">Produces: {producesText}</div>
            </div>
            <div className="text-[11px] font-bold text-white bg-[#4deeac] rounded-full px-3 py-1">
              {room.assigned_npcs}/{room.capacity} NPCs
            </div>
            {canCollect && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCollect(); }}
                className="ml-auto px-3 py-1 text-[11px] font-bold bg-gradient-to-r from-[#4deeac] to-[#3dd69a] text-[#0d1117] rounded hover:scale-105 transition-all"
              >
                Collect
              </button>
            )}
          </div>
        </div>

        {/* NPCs in room */}
        <div className="absolute inset-0 pointer-events-none">
          {npcs.map((npc, index) => {
            const baseX = 24 + index * (npcDisplayWidth + 14);
            const maxDistance = Math.max(0, ROOM_WIDTH - 12 - baseX - npcDisplayWidth);
            const patrolDistance = Math.min(160, maxDistance);
            const isWalking = npc?.status === NPC_STATUS.WORKING;

            return (
              <NPCComponent
                key={npc.id}
                npc={npc}
                position={{ x: baseX, y: npcY }}
                isWalking={isWalking}
                scale={NPC_SCALE}
                patrolDistance={isWalking ? patrolDistance : 0}
                patrolDurationSeconds={3 + (index % 3) * 0.7}
                patrolDelaySeconds={(index % 4) * 0.25}
              />
            );
          })}
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
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </>
  );
}

