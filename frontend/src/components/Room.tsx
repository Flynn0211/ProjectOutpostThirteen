import { useState } from "react";
import type { Room as RoomType } from "../types";
import { getRoomImageUrl } from "../utils/imageUtils";
import { ROOM_TYPE_NAMES } from "../constants";
import { NPCComponent } from "./NPC";
import { AssignNPCModal } from "./AssignNPCModal";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { NPC_STATUS, PACKAGE_ID } from "../constants";
import { useGameStore } from "../state/gameStore";
import { useQueryClient } from "@tanstack/react-query";
import { postTxRefresh } from "../utils/postTxRefresh";

interface RoomProps {
  room: RoomType;
  roomIndex: number;
  npcs: any[];
  bunkerId?: string;
  bunkerCapacity?: number;
  onRefresh?: () => void;
  onOpenRoomDetail?: (roomIndex: number) => void;
}

export function RoomComponent({ room, roomIndex, npcs, bunkerId, bunkerCapacity, onRefresh, onOpenRoomDetail }: RoomProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const queryClient = useQueryClient();
  const roomImageUrl = getRoomImageUrl(room.room_type);
  const roomName = ROOM_TYPE_NAMES[room.room_type as keyof typeof ROOM_TYPE_NAMES] || "Unknown";

  const isFlashing = useGameStore((s) => !!s.flashingRooms[roomIndex]);

  const workers = Number(room.assigned_npcs ?? 0);

  const formatRatePerHour = (amount: number) => `${amount}/h`;
  const getUsesAndProduces = () => {
    const uses: string[] = [];
    const produces: string[] = [];

    switch (room.room_type) {
      case 0: {
        // Living Quarters: increases bunker capacity passively
        uses.push("None");
        if (typeof bunkerCapacity === "number" && Number.isFinite(bunkerCapacity) && bunkerCapacity > 0) {
          produces.push(`Capacity ${Math.floor(bunkerCapacity)}`);
        } else {
          produces.push(`Capacity ${room.capacity}`);
        }
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

  const effectiveCapacity =
    room.room_type === 0 && typeof bunkerCapacity === "number" && Number.isFinite(bunkerCapacity) && bunkerCapacity > 0
      ? Math.floor(bunkerCapacity)
      : Number(room.capacity ?? 0);

  const ROOM_WIDTH = 460;
  const ROOM_HEIGHT = 230;
  const NPC_FRAME = 128;
  const NPC_SCALE = 0.85;
  // Reserve vertical space for the bottom room info overlay so NPCs never overlap it.
  // (Matches the visual height of the bottom info tab area.)
  const ROOM_INFO_OVERLAY_HEIGHT = 76;
  const npcDisplayWidth = NPC_FRAME * NPC_SCALE;
  const npcDisplayHeight = NPC_FRAME * NPC_SCALE;
  const npcAvailableHeight = Math.max(0, ROOM_HEIGHT - ROOM_INFO_OVERLAY_HEIGHT);
  const npcY = Math.max(0, (npcAvailableHeight - npcDisplayHeight) / 2);

  const canCollect = bunkerId && (room.room_type === 2 || room.room_type === 3 || room.room_type === 4); // FARM/WATER_PUMP/WORKSHOP

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
            if (account?.address) {
              postTxRefresh(queryClient, account.address);
              window.setTimeout(() => postTxRefresh(queryClient, account.address!), 1200);
            }
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
        className={[
          "relative flex-shrink-0 rounded-sm overflow-hidden border-2 border-primary bg-card cursor-pointer transition-all",
          isFlashing ? "ring-4 ring-primary/50" : "",
        ].join(" ")}
        style={{ width: `${ROOM_WIDTH}px`, height: `${ROOM_HEIGHT}px` }}
        onClick={() => {
          if (onOpenRoomDetail) {
            onOpenRoomDetail(roomIndex);
            return;
          }
          if (bunkerId && room.room_type !== 0) setShowAssignModal(true);
        }}
      >
        {/* Room image */}
        <img
          src={roomImageUrl}
          alt={roomName}
          className="w-full h-full object-cover brightness-110 contrast-105"
        />
        
        {/* Light overlay instead of dark */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />

        {/* Room info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <div className="bg-card/90 border border-primary rounded-sm px-3 py-2 text-foreground text-xs flex items-center justify-between gap-2">
            <div>
              <div className="font-orbitron font-bold text-sm leading-tight text-primary">{roomName}</div>
              <div className="text-[11px] text-foreground/85">Level {room.level}</div>
              <div className="text-[10px] text-foreground/85 leading-tight">Uses: {usesText}</div>
              <div className="text-[10px] text-foreground/85 leading-tight">Produces: {producesText}</div>
            </div>
            <div className="text-[11px] font-bold text-primary-foreground bg-primary rounded-sm px-3 py-1">
              {room.assigned_npcs}/{effectiveCapacity} NPCs
            </div>
            {canCollect && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCollect(); }}
                className="ml-auto vault-button px-3 py-1 text-[11px]"
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
                // Slower movement so NPCs don't zip across rooms.
                patrolDurationSeconds={8 + (index % 3) * 1.6}
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

