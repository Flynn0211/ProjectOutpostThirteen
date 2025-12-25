
import { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID } from "../constants";

type ExpeditionLog = {
  npcId: string;
  success: boolean;
  itemsGained: number;
  food: number;
  water: number;
  scrap: number;
  timestamp: number;

  txDigest: string;
  items?: { name: string; rarity: string; isRare: boolean }[];
};

interface NotificationLogModalProps {
  onClose: () => void;
}

export function NotificationLogModal({ onClose }: NotificationLogModalProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [logs, setLogs] = useState<ExpeditionLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        // Query ALL events for the sender to capture both ExpeditionResult and ItemCreated
        const events = await client.queryEvents({
          query: {
            Sender: account.address,
          },
          order: "descending",
          limit: 50,
        });

        // Group events by txDigest
        const eventsByTx: Record<string, any[]> = {};
        events.data.forEach((e) => {
          if (!eventsByTx[e.id.txDigest]) {
            eventsByTx[e.id.txDigest] = [];
          }
          eventsByTx[e.id.txDigest].push(e);
        });

        // Parse logs
        const parsedLogs: ExpeditionLog[] = [];
        
        Object.entries(eventsByTx).forEach(([digest, txEvents]) => {
          // Check for ExpeditionResultEvent
          const resultEvent = txEvents.find(e => e.type.includes("ExpeditionResultEvent"));
          if (!resultEvent) return;
          
          const resultData = resultEvent.parsedJson as any;
          
          // Find ItemCreated events in the same transaction
          const createdItems = txEvents
            .filter(e => e.type.includes("ItemCreated"))
            .map(e => {
              const itemData = e.parsedJson as any;
              // Map rarity and type to readable strings if needed, or just use raw data
              // Helper to decode rarity/type
              const getRarityName = (r: number) => {
                if(r === 1) return "Common";
                if(r === 2) return "Rare";
                if(r === 3) return "Epic";
                if(r === 4) return "Legendary";
                return "Unknown";
              };
               const getTypeName = (t: number) => {
                if(t === 1) return "Weapon";
                if(t === 2) return "Armor";
                if(t === 3) return "Tool";
                if(t === 4) return "Medicine";
                if(t === 5) return "Revival";
                if(t === 6) return "Food";
                if(t === 7) return "Water";
                if(t === 99) return "Collectible";
                return "Item";
              };

              return {
                id: itemData.item_id,
                name: getTypeName(itemData.item_type), // Using type name as we don't have item unique names yet
                rarity: getRarityName(itemData.rarity),
                isRare: itemData.rarity > 1
              };
            });

          parsedLogs.push({
            npcId: resultData.npc_id,
            success: resultData.success,
            itemsGained: Number(resultData.items_gained),
            food: Number(resultData.food_gained),
            water: Number(resultData.water_gained),
            scrap: Number(resultData.scrap_gained),
            timestamp: Number(resultEvent.timestampMs),
            txDigest: digest,
            items: createdItems
          });
        });

        // Sort by timestamp desc
        parsedLogs.sort((a, b) => b.timestamp - a.timestamp);

        setLogs(parsedLogs);
      } catch (err) {
        console.error("Failed to fetch notification logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [account, client]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#1a1f2e] border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-[#0d121f]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">📜</span> Expedition Logs
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <span className="text-2xl text-gray-400">&times;</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="text-center py-8 text-gray-400 animate-pulse">
              Translating Vault-Tec data...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 italic">
              No recent expedition records found.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.txDigest}
                className={`flex gap-4 p-3 rounded-lg border ${
                  log.success
                    ? "bg-green-900/10 border-green-500/20"
                    : "bg-red-900/10 border-red-500/20"
                }`}
              >
                {/* Status Icon */}
                <div
                  className={`mt-1 text-2xl ${
                    log.success ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {log.success ? "✅" : "❌"}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`font-semibold ${
                        log.success ? "text-green-300" : "text-red-300"
                      }`}
                    >
                      {log.success ? "Mission Success" : "Mission Failed"}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-sm text-gray-300 font-mono space-y-1">
                    <div>
                      Assignee:{" "}
                      <span className="text-blue-300">
                        {log.npcId.slice(0, 6)}...{log.npcId.slice(-4)}
                      </span>
                    </div>
                    {log.success && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {log.itemsGained > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
                            🎁 {log.itemsGained} Items
                          </span>
                        )}
                        {/* Detailed Items List */}
                        {log.items && log.items.length > 0 && (
                          <div className="w-full mt-1 space-y-1">
                            {log.items.map((item: any, idx: number) => (
                              <div key={idx} className={`text-xs px-2 py-1 rounded border flex justify-between ${
                                item.isRare 
                                  ? "bg-purple-500/20 border-purple-500/40 text-purple-200" 
                                  : "bg-gray-700/30 border-gray-600 text-gray-300"
                              }`}>
                                <span>{item.rarity} {item.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(log.food > 0 || log.water > 0) && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs">
                            🍖 Food {log.food} | 💧 Water {log.water}
                          </span>
                        )}
                        {log.scrap > 0 && (
                          <span className="px-2 py-0.5 rounded bg-gray-500/20 text-gray-300 border border-gray-500/30 text-xs">
                            ⚙️ Scrap {log.scrap}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
