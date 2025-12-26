import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query/queryKeys";

export function postTxRefresh(queryClient: QueryClient, ownerAddress: string) {
  if (!ownerAddress) return;

  const key = queryKeys.ownedRoot(ownerAddress);

  const pulse = () => {
    queryClient.invalidateQueries({ queryKey: key });
    // Force a refetch so UI updates immediately.
    void queryClient.refetchQueries({ queryKey: key, type: "active" });

    // Backward-compat: keep legacy events for components not yet migrated to React Query.
    window.dispatchEvent(new CustomEvent("inventory-updated"));
    window.dispatchEvent(new CustomEvent("bunker-updated"));
    window.dispatchEvent(new CustomEvent("npcs-updated"));
  };

  // Sui owned-object indexing can lag briefly after tx execution.
  // Do a short burst of refreshes to avoid requiring the user to hit manual refresh.
  // Keep this small to reduce RPC load.
  pulse();
  window.setTimeout(pulse, 1200);
  window.setTimeout(pulse, 3200);
  window.setTimeout(pulse, 6500);
}
