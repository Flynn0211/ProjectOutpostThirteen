import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import type { Bunker } from "../types";
import { IMAGES, NETWORK, PACKAGE_ID } from "../constants";
import { RoomComponent } from "./Room";
import { CreateBunkerModal } from "./CreateBunkerModal";
import { ResourcesBar } from "./ResourcesBar";
import { AddRoomButton } from "./AddRoomButton";
import { useOwnedBunkers, useOwnedNpcs } from "../query/ownedQueries";
import { useSuiEventSubscriptions } from "../hooks/useSuiEventSubscriptions";

interface BunkerViewProps {
  onBunkerLoaded?: (bunkerId: string) => void;
  refreshTick?: number;
  onOpenRoomDetail?: (roomIndex: number) => void;
  onOpenUpgradeBunker?: () => void;
}

export function BunkerView({ onBunkerLoaded, refreshTick, onOpenRoomDetail, onOpenUpgradeBunker }: BunkerViewProps) {
  const account = useCurrentAccount();
  const ownerAddress = account?.address ?? "";

  const bunkersQuery = useOwnedBunkers(ownerAddress);
  const npcsQuery = useOwnedNpcs(ownerAddress);

  useSuiEventSubscriptions({ ownerAddress });

  const bunker: Bunker | null = useMemo(() => {
    const list = bunkersQuery.data ?? [];
    return (list.length > 0 ? (list[0] as Bunker) : null) ?? null;
  }, [bunkersQuery.data]);

  const npcs = npcsQuery.data ?? [];

  const loading = bunkersQuery.isLoading || npcsQuery.isLoading;
  const isRefreshing = bunkersQuery.isFetching || npcsQuery.isFetching;
  const [showCreateModal, setShowCreateModal] = useState(false);

  const error = (bunkersQuery.error as any) ?? (npcsQuery.error as any) ?? null;

  useEffect(() => {
    if (onBunkerLoaded && bunker?.id) {
      onBunkerLoaded(bunker.id);
    }
  }, [bunker?.id, onBunkerLoaded]);

  // Trigger refresh when parent signals
  const lastRefreshTickRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!ownerAddress) return;
    if (refreshTick === undefined) return;

    // Avoid refetch-on-mount (and React StrictMode double-invoke) which can cause RPC rate limiting.
    if (lastRefreshTickRef.current === undefined) {
      lastRefreshTickRef.current = refreshTick;
      return;
    }
    if (lastRefreshTickRef.current === refreshTick) return;

    lastRefreshTickRef.current = refreshTick;
    void bunkersQuery.refetch();
    void npcsQuery.refetch();
  }, [refreshTick, ownerAddress, bunkersQuery, npcsQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading bunker...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-center max-w-2xl px-6">
          <div className="text-xl font-bold mb-2">Failed to load bunker data</div>
          <div className="text-sm text-white/80 break-words">{String(error?.message ?? error)}</div>
          <div className="text-sm text-white/70 mt-3">If you are on localhost, restart dev server after pulling.</div>
        </div>
      </div>
    );
  }

  if (!bunker) {
    // If we're still fetching (or retrying) bunker data, don't show the "Create Bunker" empty state.
    if (bunkersQuery.isFetching) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="text-white text-xl">Loading bunker...</div>
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="text-center">
            <p className="text-white text-xl mb-4">No bunker found</p>
            <div className="text-white/70 text-sm mb-4 space-y-1">
              <div>Network: <span className="text-white/90">{NETWORK}</span></div>
              <div className="break-all">Package: <span className="text-white/90">{PACKAGE_ID}</span></div>
              <div className="text-white/60">Bunkers are per-network and per-package deployment.</div>
            </div>
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
            void bunkersQuery.refetch();
            void npcsQuery.refetch();
          }}
        />
      </>
    );
  }

  const rooms = bunker.rooms || [];

  const getAssignedRoomIndex = (npc: any): number | null => {
    const v: any = npc?.assigned_room;
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    if (typeof v === "object") {
      if (Array.isArray(v.vec)) return v.vec.length ? Number(v.vec[0]) : null;
      if ("some" in v) return Number((v as any).some);
    }
    return null;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Sky / surface layer */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${IMAGES.background})` }}
      />
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

      {/* Resources bar centered top */}
      <ResourcesBar bunker={bunker} onLevelClick={onOpenUpgradeBunker} />
      
      {/* Manual Refresh Button */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={() => {
            void bunkersQuery.refetch();
            void npcsQuery.refetch();
          }}
          disabled={isRefreshing}
          className="p-2 bg-gray-800/80 hover:bg-gray-700 text-[#4deeac] border border-[#4deeac] rounded-lg transition-all shadow-[0_0_10px_rgba(77,238,172,0.3)] hover:shadow-[0_0_15px_rgba(77,238,172,0.5)] flex items-center gap-2"
          title="Refresh Data"
        >
          <span className={`text-xl ${isRefreshing ? 'animate-spin' : ''}`}>↻</span>
        </button>
      </div>

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
                npcs={npcs.filter((npc) => getAssignedRoomIndex(npc) === roomIndex)}
                bunkerId={bunker.id}
                onOpenRoomDetail={onOpenRoomDetail}
                onRefresh={() => {
                  void bunkersQuery.refetch();
                  void npcsQuery.refetch();
                }}
              />
            ))}

            <div className="flex-shrink-0">
              <AddRoomButton
                bunkerId={bunker.id}
                onSuccess={() => {
                  void bunkersQuery.refetch();
                  void npcsQuery.refetch();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

