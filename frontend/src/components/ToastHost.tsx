import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query/queryKeys";
import {
  loadTrackedExpeditions,
  markExpeditionNotified,
  removeTrackedExpedition,
  type TrackedExpedition,
} from "../utils/expeditionTracker";

type Toast = {
  id: string;
  title: string;
  body: string;
};

const TOAST_LIFETIME_MS = 8000;

function summarize(exp: TrackedExpedition): string {
  const r = exp.result;
  if (!r) return "Thám hiểm đã hoàn tất.";

  const lines: string[] = [];
  lines.push(r.success ? "Kết quả: Thành công" : "Kết quả: Thất bại");

  const lootLines: string[] = [];
  if (r.foodGained) lootLines.push(`- Thức ăn: +${r.foodGained}`);
  if (r.waterGained) lootLines.push(`- Nước: +${r.waterGained}`);
  if (r.scrapGained) lootLines.push(`- Phế liệu: +${r.scrapGained}`);
  if (r.itemsGained) lootLines.push(`- Vật phẩm: +${r.itemsGained}`);
  if (r.blueprintDroppedCount) lootLines.push(`- Bản vẽ: +${r.blueprintDroppedCount}`);

  if (lootLines.length > 0) {
    lines.push("Loot:");
    lines.push(...lootLines);
  } else {
    lines.push("Loot: (không có)");
  }

  if (r.damageTaken) lines.push(`Sát thương nhận: ${r.damageTaken}`);
  return lines.join("\n");
}

export function ToastHost() {
  const account = useCurrentAccount();
  const ownerAddress = account?.address ?? "";
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const canRun = useMemo(() => !!ownerAddress, [ownerAddress]);

  useEffect(() => {
    if (!canRun) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const tracked = loadTrackedExpeditions(ownerAddress);
      const due = tracked.filter((e) => !e.notified && e.endsAtMs <= now);
      if (due.length === 0) return;

      due.forEach((exp) => {
        markExpeditionNotified(ownerAddress, exp.npcId);

        const toast: Toast = {
          id: `${exp.npcId}:${exp.endsAtMs}`,
          title: `${exp.npcName} đã xong thám hiểm`,
          body: summarize(exp),
        };

        setToasts((prev) => [toast, ...prev].slice(0, 5));

        // Refresh cached on-chain data (owned objects) immediately.
        queryClient.invalidateQueries({ queryKey: queryKeys.ownedRoot(ownerAddress) });
        // Backward-compat: keep legacy events for components not yet migrated.
        window.dispatchEvent(new CustomEvent("inventory-updated"));
        window.dispatchEvent(new CustomEvent("bunker-updated"));
        window.dispatchEvent(new CustomEvent("npcs-updated"));

        // Clean up tracking to avoid infinite toasts.
        removeTrackedExpedition(ownerAddress, exp.npcId);

        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, TOAST_LIFETIME_MS);
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [canRun, ownerAddress]);

  if (!canRun || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] w-[360px] space-y-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-2 border-[#4deeac] rounded-xl p-4 shadow-[0_0_25px_rgba(77,238,172,0.35)]"
        >
          <div className="text-sm font-bold text-[#4deeac] uppercase tracking-wider">{t.title}</div>
          <pre className="mt-2 text-xs text-white/80 whitespace-pre-wrap font-sans">{t.body}</pre>
        </div>
      ))}
    </div>
  );
}
