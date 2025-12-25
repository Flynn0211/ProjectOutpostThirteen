import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { suiClient } from "../utils/sui";
import { PACKAGE_ID } from "../constants";
import { queryKeys } from "../query/queryKeys";
import { useGameStore } from "../state/gameStore";

type Props = {
  ownerAddress: string;
};

const eventType = (name: string) => `${PACKAGE_ID}::utils::${name}`;

export function useSuiEventSubscriptions({ ownerAddress }: Props) {
  const queryClient = useQueryClient();
  const flashRoom = useGameStore((s) => s.flashRoom);
  const lastInvalidateAtRef = useRef(0);

  useEffect(() => {
    if (!ownerAddress) return;

    const subs: Array<{ unsubscribe: () => void }> = [];
    let cancelled = false;

    const invalidateOwnedThrottled = () => {
      const now = Date.now();
      if (now - lastInvalidateAtRef.current < 1000) return;
      lastInvalidateAtRef.current = now;
      queryClient.invalidateQueries({ queryKey: queryKeys.ownedRoot(ownerAddress) });
    };

    const subscribe = async (moveEvent: string) => {
      const unsubscribe = await suiClient.subscribeEvent({
        filter: {
          All: [
            { Sender: ownerAddress },
            { MoveEventType: moveEvent },
          ],
        },
        onMessage: (evt) => {
          // Fast path: refresh cached owned objects
          invalidateOwnedThrottled();

          // Room flash for production/assignment events
          try {
            const parsed: any = (evt as any)?.parsedJson ?? (evt as any)?.parsed_json;
            const roomIndexRaw = parsed?.room_index ?? parsed?.roomIndex;
            const roomIndex = typeof roomIndexRaw === "number" ? roomIndexRaw : typeof roomIndexRaw === "string" ? Number(roomIndexRaw) : NaN;
            if (!Number.isNaN(roomIndex)) {
              flashRoom(roomIndex);
            }
          } catch {
            // ignore
          }
        },
      });

      if (cancelled) {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
        return;
      }

      subs.push({ unsubscribe });
    };

    // We intentionally subscribe only to events that should trigger immediate UI refresh.
    // (More can be added later without touching the rest of the app.)
    void subscribe(eventType("ProductionCollectedEvent"));
    void subscribe(eventType("WorkAssignedEvent"));
    void subscribe(eventType("BunkerUpgradeEvent"));
    void subscribe(eventType("EquipEvent"));
    void subscribe(eventType("ExpeditionResultEvent"));

    return () => {
      cancelled = true;
      subs.forEach((s) => {
        try {
          s.unsubscribe();
        } catch {
          // ignore
        }
      });
    };
  }, [ownerAddress, flashRoom, queryClient]);
}
