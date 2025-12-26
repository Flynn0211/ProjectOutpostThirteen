import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useQueryClient } from "@tanstack/react-query";

import type { NPC, Room } from "../types";
import { NPC_STATUS, PACKAGE_ID, RARITY_NAMES, ROOM_TYPE_NAMES } from "../constants";
import { queryKeys } from "../query/queryKeys";
import { useOwnedNpcs } from "../query/ownedQueries";
import { useBunker } from "../query/singleQueries";

interface RoomDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
  roomIndex: number;
}

export function RoomDetailModal({ isOpen, onClose, bunkerId, roomIndex }: RoomDetailModalProps) {
  const account = useCurrentAccount();
  const ownerAddress = account?.address ?? "";

  const queryClient = useQueryClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();

  // Use efficient single bunker fetch
  const { data: bunker, isFetching: isFetchingBunker } = useBunker(bunkerId);
  // We still need all NPCs to find idle ones, but we can rely on cached data
  const { data: npcs, isFetching: isFetchingNpcs } = useOwnedNpcs(ownerAddress);

  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line
    setSelectedNpcId(null);
    // eslint-disable-next-line
    setLoading(false);
  }, [isOpen, bunkerId, roomIndex]);

  const room: Room | null = useMemo(() => {
    if (!bunker) return null;
    const rooms = bunker.rooms || [];
    if (roomIndex < 0 || roomIndex >= rooms.length) return null;
    return rooms[roomIndex] ?? null;
  }, [bunker, roomIndex]);

  const roomName = useMemo(() => {
    if (!room) return "Room";
    return ROOM_TYPE_NAMES[room.room_type as keyof typeof ROOM_TYPE_NAMES] || "Unknown";
  }, [room]);

  const powerSufficient = useMemo(() => {
    if (!bunker) return true;
    const gen = Number((bunker as any).power_generation || 0);
    const con = Number((bunker as any).power_consumption || 0);
    return gen >= con;
  }, [bunker]);

  const getAssignedRoomIndex = (npc: NPC): number | null => {
    const v: any = (npc as any).assigned_room;
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    if (typeof v === "object") {
      if (Array.isArray(v.vec)) return v.vec.length ? Number(v.vec[0]) : null;
      if ("some" in v) return Number((v as any).some);
    }
    return null;
  };

  const assignedHere = useMemo(() => {
    return (npcs || []).filter((npc) => {
      const assigned = getAssignedRoomIndex(npc);
      return npc.status === NPC_STATUS.WORKING && assigned === roomIndex;
    });
  }, [npcs, roomIndex]);

  const idleNPCs = useMemo(() => {
    return (npcs || []).filter((npc) => npc.status === NPC_STATUS.IDLE);
  }, [npcs]);

  const formatRatePerHour = (amount: number) => `${amount}/h`;
  const usesAndProduces = useMemo(() => {
    if (!room) return { usesText: "", producesText: "" };
    const workers = Number(room.assigned_npcs ?? 0);
    const uses: string[] = [];
    const produces: string[] = [];

    switch (room.room_type) {
      case 0: {
        uses.push("None");
        produces.push(`Capacity +${room.capacity}`);
        break;
      }
      case 1: {
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
  }, [room]);

  const handleAssign = async () => {
    if (!account?.address || !selectedNpcId || !bunkerId) return;
    if (!room) return;

    if (!powerSufficient) {
      alert("Insufficient power. Please ensure Generator output covers consumption.");
      return;
    }

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::npc::assign_to_room`,
        arguments: [tx.object(selectedNpcId), tx.object(bunkerId), tx.pure(roomIndex, "u64"), tx.object("0x6")],
      });

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: async () => {
            alert("NPC assigned!");
            await Promise.all([
               queryClient.invalidateQueries({ queryKey: queryKeys.bunker(bunkerId) }),
               queryClient.invalidateQueries({ queryKey: queryKeys.npcs(ownerAddress) })
            ]);
            setSelectedNpcId(null);
            setLoading(false);
          },
          onError: (error: any) => {
            alert("Assign failed: " + (error?.message ?? String(error)));
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      alert("Assign failed: " + (e?.message ?? String(e)));
      setLoading(false);
    }
  };

  const handleUnassign = async (npcId: string) => {
    if (!account?.address || !npcId || !bunkerId) return;

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::npc::unassign_from_room`,
        arguments: [tx.object(npcId), tx.object(bunkerId), tx.object("0x6")],
      });

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: async () => {
            alert("NPC removed!");
             await Promise.all([
               queryClient.invalidateQueries({ queryKey: queryKeys.bunker(bunkerId) }),
               queryClient.invalidateQueries({ queryKey: queryKeys.npcs(ownerAddress) })
            ]);
            setLoading(false);
          },
          onError: (error: any) => {
            alert("Remove failed: " + (error?.message ?? String(error)));
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      alert("Remove failed: " + (e?.message ?? String(e)));
      setLoading(false);
    }
  };

  const handleUpgradeRoom = async () => {
    if (!account?.address || !bunkerId) return;

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::bunker::upgrade_room`,
        arguments: [tx.object(bunkerId), tx.pure(roomIndex, "u64")],
      });

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: async () => {
             alert("Room upgraded!");
             await queryClient.invalidateQueries({ queryKey: queryKeys.bunker(bunkerId) });
             setLoading(false);
          },
          onError: (error: any) => {
            alert("Upgrade room failed: " + (error?.message ?? String(error)));
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      alert("Upgrade room failed: " + (e?.message ?? String(e)));
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const roomFull = !!room && Number(room.assigned_npcs ?? 0) >= Number(room.capacity ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-5xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#5fffc0] rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#5fffc0] rounded-br-2xl" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer" />

        <div className="relative flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">
              {roomName} • Room #{roomIndex}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        <div className="relative grid grid-cols-2 gap-6">
          {/* Left: Room info */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#4deeac] rounded-xl p-4 shadow-[0_0_15px_rgba(77,238,172,0.25)]">
              <div className="text-[#4deeac] font-bold uppercase text-sm tracking-wider">Room Info</div>
              {room ? (
                <div className="text-white/85 text-sm mt-2 space-y-1">
                  <div>
                    Type: <span className="text-white font-bold">{roomName}</span>
                  </div>
                  <div>
                    Level: <span className="text-white font-bold">{Number(room.level ?? 0)}</span>
                  </div>
                  <div>
                    Capacity: <span className="text-white font-bold">{Number(room.assigned_npcs ?? 0)}/{Number(room.capacity ?? 0)}</span>
                  </div>
                  <div>
                    Efficiency: <span className="text-white font-bold">{Number(room.efficiency ?? 0)}%</span>
                  </div>
                  <div>
                    Production rate: <span className="text-white font-bold">{Number(room.production_rate ?? 0)}/h</span>
                  </div>
                  <div className="pt-2 text-[12px]">
                    <div className="text-white/90">Uses: {usesAndProduces.usesText}</div>
                    <div className="text-white/90">Produces: {usesAndProduces.producesText}</div>
                  </div>
                </div>
              ) : (
                <div className="text-white/70 text-sm mt-2">Loading room...</div>
              )}
            </div>

            {!powerSufficient && (
              <div className="bg-gradient-to-r from-[#1a1f2e] to-[#0d1117] border-2 border-[#ffc107] p-4 rounded-xl shadow-[0_0_15px_rgba(255,193,7,0.25)]">
                <div className="text-[#ffc107] font-bold">⚠️ Insufficient power</div>
                <div className="text-white/80 text-sm mt-1">Remove NPCs or increase Generator output.</div>
              </div>
            )}

            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#4deeac] rounded-xl p-4 shadow-[0_0_15px_rgba(77,238,172,0.2)]">
              <div className="text-[#4deeac] font-bold uppercase text-sm tracking-wider">Upgrade</div>
              <div className="text-white/80 text-sm mt-2">
                Cost: <span className="text-white font-bold">50 Scrap</span>
              </div>
              <button
                onClick={handleUpgradeRoom}
                disabled={loading || !room}
                className="mt-3 w-full px-6 py-3 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(77,238,172,0.6)] hover:shadow-[0_0_30px_rgba(77,238,172,0.8)] hover:scale-[1.02] disabled:shadow-none"
              >
                {loading ? "Upgrading..." : "⬆️ Upgrade Room"}
              </button>
            </div>
          </div>

          {/* Right: NPC management */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#4deeac] rounded-xl p-4 shadow-[0_0_15px_rgba(77,238,172,0.25)]">
              <div className="text-[#4deeac] font-bold uppercase text-sm tracking-wider">NPCs in this room</div>

              {assignedHere.length === 0 ? (
                <div className="text-gray-400 text-sm mt-3">No NPCs currently assigned.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  {assignedHere.map((npc) => (
                    <div
                      key={npc.id}
                      className="p-4 rounded-xl border-2 border-[#4deeac] bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] text-white shadow-[0_0_12px_rgba(77,238,172,0.25)]"
                    >
                      <div className="font-bold truncate text-base mb-1">{npc.name}</div>
                      <div className="text-xs font-semibold text-[#4deeac]">
                        {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]}
                      </div>
                      <div className="text-xs mt-2 flex items-center gap-1">
                        <span>❤️</span> HP: {npc.current_hp}/{npc.max_hp}
                      </div>
                      <button
                        onClick={() => handleUnassign(npc.id)}
                        disabled={loading}
                        className="mt-3 w-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#ffc107] to-[#ffb300] text-[#0d1117] rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {loading ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#4deeac] rounded-xl p-4 shadow-[0_0_15px_rgba(77,238,172,0.25)]">
              <div className="text-[#4deeac] font-bold uppercase text-sm tracking-wider">Add / Assign NPC</div>

              {idleNPCs.length === 0 ? (
                <div className="text-gray-400 text-sm mt-3">No available NPCs (must be IDLE).</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mt-3 max-h-80 overflow-y-auto pr-2">
                    {idleNPCs.map((npc) => (
                      <div
                        key={npc.id}
                        onClick={() => setSelectedNpcId(npc.id)}
                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 transform hover:scale-[1.02] ${
                          selectedNpcId === npc.id
                            ? "bg-gradient-to-br from-[#4deeac] to-[#3dd69a] border-[#5fffc0] text-[#0d1117] shadow-[0_0_20px_rgba(77,238,172,0.8)]"
                            : "bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] hover:from-[#2a3447] hover:to-[#1a1f2e] border-[#4deeac] text-white hover:shadow-[0_0_15px_rgba(77,238,172,0.4)]"
                        }`}
                      >
                        <div className="font-bold truncate text-base mb-1">{npc.name}</div>
                        <div
                          className={`text-xs font-semibold ${selectedNpcId === npc.id ? "text-[#0d1117]" : "text-[#4deeac]"}`}
                        >
                          {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]}
                        </div>
                        <div className="text-xs mt-2 flex items-center gap-1">
                          <span>❤️</span> HP: {npc.current_hp}/{npc.max_hp}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleAssign}
                    disabled={
                      loading ||
                      !selectedNpcId ||
                      !room ||
                      roomFull ||
                      !powerSufficient
                    }
                    className="mt-4 w-full px-6 py-3 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(77,238,172,0.6)] hover:shadow-[0_0_30px_rgba(77,238,172,0.8)] hover:scale-[1.02] disabled:shadow-none"
                  >
                    {loading ? "Assigning..." : roomFull ? "Room Full" : "✅ Assign NPC to Room"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {(isFetchingBunker || isFetchingNpcs) && (
          <div className="relative mt-5 text-center text-white/70 text-sm">Syncing...</div>
        )}
      </div>
    </div>
  );
}
