import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { NPC_STATUS, PACKAGE_ID, RAID_HISTORY_ID, RARITY_NAMES } from "../constants";
import type { NPC } from "../types";
import { useOwnedNpcsEnabled } from "../query/ownedQueries";
import { suiClient, getObject } from "../utils/sui";
import { isNpcOnExpedition } from "../utils/expeditionTracker";
import { postTxRefresh } from "../utils/postTxRefresh";
import { ModalShell } from "./ModalShell";

interface RaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
}

export function RaidModal({ isOpen, onClose, bunkerId }: RaidModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const queryClient = useQueryClient();
  const [selectedNpcIds, setSelectedNpcIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [discovering, setDiscovering] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [candidateBunkerIds, setCandidateBunkerIds] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    bunkerId: string;
    owner: string;
    level: number;
    defenders: number;
    food: number;
    water: number;
    scrap: number;
  } | null>(null);

  const raidHistoryId = RAID_HISTORY_ID;

  const ownerAddress = account?.address ?? "";
  const npcsQuery = useOwnedNpcsEnabled(ownerAddress, isOpen);
  const npcs = (npcsQuery.data ?? []) as NPC[];

  const availableNpcs = useMemo(() => {
    if (!ownerAddress) return [];
    return npcs.filter((n) => {
      if (n.status !== NPC_STATUS.IDLE) return false;
      if (isNpcOnExpedition(ownerAddress, n.id, nowMs)) return false;
      return n.current_hp > 20 && n.current_stamina > 30 && n.hunger > 20 && n.thirst > 20;
    });
  }, [npcs, ownerAddress, nowMs]);

  const npcCount = selectedNpcIds.length;

  const bunkerEventType = useMemo(() => `${PACKAGE_ID}::utils::BunkerUpgradeEvent`, []);

  const sampleTargets = (allIds: string[]) => {
    const pool = allIds.filter((id) => !!id && id !== bunkerId);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  };

  const discoverTargets = async () => {
    setDiscovering(true);
    try {
      const events = await suiClient.queryEvents({
        query: { MoveEventType: bunkerEventType },
        limit: 200,
        order: "descending",
      });

      const ids = new Set<string>();
      for (const evt of events.data as any[]) {
        const parsed = (evt as any)?.parsedJson ?? (evt as any)?.parsed_json;
        const bunker = parsed?.bunker_id ?? parsed?.bunkerId;
        if (typeof bunker === "string" && bunker.startsWith("0x")) {
          ids.add(bunker);
        }
      }

      const list = Array.from(ids);
      setCandidateBunkerIds(list);
      setTargets(sampleTargets(list));
      setSelectedTargetId(null);
      setSelectedSnapshot(null);
    } catch (e) {
      console.error("Discover raid targets failed:", e);
      setCandidateBunkerIds([]);
      setTargets([]);
    } finally {
      setDiscovering(false);
    }
  };

  const refreshTargets = () => {
    setTargets(sampleTargets(candidateBunkerIds));
    setSelectedTargetId(null);
    setSelectedSnapshot(null);
  };

  const loadTargetSnapshot = async (targetId: string) => {
    setSnapshotLoading(true);
    try {
      const obj: any = await getObject(targetId);
      if (!obj) throw new Error("Target bunker not found");

      const rooms = Array.isArray(obj.rooms) ? obj.rooms : [];
      const defenders = rooms.reduce((sum: number, r: any) => sum + Number(r?.assigned_npcs ?? 0), 0);
      const owner = String(obj.owner ?? "");

      if (account?.address && owner === account.address) {
        alert("You cannot raid your own bunker.");
        setSelectedTargetId(null);
        setSelectedSnapshot(null);
        return;
      }

      setSelectedSnapshot({
        bunkerId: String(obj.id ?? targetId),
        owner,
        level: Number(obj.level ?? 1),
        defenders,
        food: Number(obj.food ?? 0),
        water: Number(obj.water ?? 0),
        scrap: Number(obj.scrap ?? 0),
      });
    } catch (e) {
      console.error("Load target snapshot failed:", e);
      alert("Failed to load target. Try another.");
      setSelectedTargetId(null);
      setSelectedSnapshot(null);
    } finally {
      setSnapshotLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(false);
    setSelectedNpcIds([]);
    setSelectedTargetId(null);
    setSelectedSnapshot(null);
    void discoverTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !ownerAddress) return;

    setSelectedNpcIds((prev) => {
      const availableSet = new Set(availableNpcs.map((n) => n.id));
      const next = prev.filter((id) => availableSet.has(id));
      if (next.length > 0) return next;
      const first = availableNpcs[0]?.id;
      return first ? [first] : [];
    });
  }, [isOpen, ownerAddress, availableNpcs]);

  if (!isOpen) return null;

  const handleRaid = async () => {
    if (!account?.address || !raidHistoryId || !selectedSnapshot) {
      alert(!raidHistoryId ? "Raid is not configured (missing RAID_HISTORY_ID)." : "Missing target.");
      return;
    }

    if (npcCount <= 0) {
      alert("Select at least 1 ready NPC to raid.");
      return;
    }

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(100_000_000)]); // 0.1 SUI
      tx.moveCall({
        target: `${PACKAGE_ID}::raid::start_raid`,
        arguments: [
          tx.object(bunkerId),
          tx.pure(npcCount, "u64"),
          tx.pure(selectedSnapshot.bunkerId, "address"),
          tx.pure(selectedSnapshot.owner, "address"),
          tx.pure(selectedSnapshot.level, "u64"),
          tx.pure(selectedSnapshot.defenders, "u64"),
          tx.pure(selectedSnapshot.food, "u64"),
          tx.pure(selectedSnapshot.water, "u64"),
          tx.pure(selectedSnapshot.scrap, "u64"),
          coin,
          tx.object(raidHistoryId),
          tx.object("0x6"), // Clock
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            if (ownerAddress) {
              postTxRefresh(queryClient, ownerAddress);
              window.setTimeout(() => postTxRefresh(queryClient, ownerAddress), 1200);
            }
            alert("Raid started!");
            onClose();
          },
          onError: (error: any) => {
            console.error("Raid error:", error);
            alert("Raid failed: " + error.message);
          },
        }
      );
    } catch (error: any) {
      console.error("Raid error:", error);
      alert("Raid failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell open={isOpen} title="Raid" onClose={onClose} className="max-w-3xl">
      <div className="space-y-4">
        {!raidHistoryId ? (
          <div className="vault-card p-4 border border-destructive">
            <div className="font-orbitron font-bold text-sm tracking-wider text-destructive">Raid not configured</div>
            <div className="text-muted-foreground text-sm mt-2">
              Missing shared object id for <span className="font-bold">RaidHistory</span>. Set
              <span className="font-bold"> VITE_RAID_HISTORY_ID</span> in your frontend env.
            </div>
          </div>
        ) : null}

        <div className="vault-card p-4">
          <div className="terminal-glow font-orbitron font-bold text-sm tracking-wider">Raid Setup</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">Select NPCs</div>
              {npcsQuery.isLoading ? (
                <div className="text-muted-foreground text-sm mt-2">Loading NPCs...</div>
              ) : npcsQuery.error ? (
                <div className="text-destructive text-sm mt-2">
                  Failed to load NPCs: {String((npcsQuery.error as any)?.message ?? npcsQuery.error)}
                </div>
              ) : availableNpcs.length === 0 ? (
                <div className="text-muted-foreground text-sm mt-2">
                  No ready NPCs (must be IDLE, not on expedition, HP &gt; 20, Stamina &gt; 30, Hunger &gt; 20, Thirst &gt; 20)
                </div>
              ) : (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground">Selected: {npcCount}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {availableNpcs.map((npc) => {
                      const selected = selectedNpcIds.includes(npc.id);
                      return (
                        <button
                          key={npc.id}
                          type="button"
                          onClick={() =>
                            setSelectedNpcIds((prev) =>
                              prev.includes(npc.id) ? prev.filter((id) => id !== npc.id) : [...prev, npc.id]
                            )
                          }
                          className={[
                            "vault-card p-3 border transition-all text-left",
                            selected ? "border-primary" : "border-primary/40 hover:border-primary",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-orbitron font-bold text-sm truncate">{npc.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {RARITY_NAMES[npc.rarity as keyof typeof RARITY_NAMES]}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                HP: {npc.current_hp}/{npc.max_hp} · Stamina: {npc.current_stamina}/{npc.max_stamina}
                              </div>
                            </div>
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              {selected ? "Selected" : "Select"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <div><span className="text-primary font-bold">Cost:</span> 50 Scrap + 0.1 SUI</div>
              <div><span className="text-primary font-bold">Cooldown:</span> 24h per target</div>
              <div><span className="text-primary font-bold">Limit:</span> 3 raids/day</div>
            </div>
          </div>
        </div>

        <div className="vault-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="terminal-glow font-orbitron font-bold text-sm tracking-wider">Targets</div>
            <button
              type="button"
              onClick={refreshTargets}
              disabled={discovering || candidateBunkerIds.length === 0}
              className="vault-button px-3 py-2 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {discovering ? "Loading..." : "Refresh"}
            </button>
          </div>

          {discovering ? (
            <div className="text-muted-foreground text-sm mt-3">Searching bunkers...</div>
          ) : targets.length === 0 ? (
            <div className="text-muted-foreground text-sm mt-3">No targets found yet.</div>
          ) : (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {targets.map((id, idx) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSelectedTargetId(id);
                    void loadTargetSnapshot(id);
                  }}
                  disabled={snapshotLoading}
                  className={[
                    "vault-card p-3 border transition-all text-left",
                    selectedTargetId === id ? "border-primary" : "border-primary/40 hover:border-primary",
                    snapshotLoading ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-orbitron font-bold text-sm">Unknown bunker #{idx + 1}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {selectedTargetId === id ? (snapshotLoading ? "Selecting..." : "Selected") : "Select"}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">No intel available</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleRaid}
          disabled={loading || !raidHistoryId || !selectedSnapshot || snapshotLoading || npcCount <= 0}
          className="vault-button w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Raiding..." : "Start Raid"}
        </button>
      </div>
    </ModalShell>
  );
}

