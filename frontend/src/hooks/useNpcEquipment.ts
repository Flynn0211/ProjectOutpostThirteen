import { useState, useEffect, useCallback } from "react";
import { suiClient, parseObjectData } from "../utils/sui";
import type { Item } from "../types";

const EQUIPMENT_SLOTS = ["slot_weapon", "slot_armor", "slot_tool_1", "slot_tool_2"];

export interface NpcEquipment {
  weapon: Item | null;
  armor: Item | null;
  tool1: Item | null;
  tool2: Item | null;
}

export function useNpcEquipment(npcId: string | null) {
  const [equipment, setEquipment] = useState<NpcEquipment>({
    weapon: null,
    armor: null,
    tool1: null,
    tool2: null,
  });
  const [loading, setLoading] = useState(false);

  const fetchEquipment = useCallback(async () => {
    if (!npcId) return;

    setLoading(true);
    try {
      // 1. Get all dynamic fields of the NPC
      const fields = await suiClient.getDynamicFields({
         parentId: npcId,
      });

      // Map to find object IDs
      const slots: Record<string, string> = {}; // slotName -> objectId

      for (const field of fields.data) {
          let name = String(field.name.value);
          
          // Handle vector<u8> keys which might be returned as byte arrays
          if (field.name.type === 'vector<u8>' && Array.isArray(field.name.value)) {
              name = new TextDecoder().decode(new Uint8Array(field.name.value as number[]));
          }

          const objectId = field.objectId;
          
          if (EQUIPMENT_SLOTS.includes(name)) {
              slots[name] = objectId;
          }
      }

      // 2. Multi-get the item objects
      const objectIds = Object.values(slots);
      if (objectIds.length === 0) {
          setEquipment({ weapon: null, armor: null, tool1: null, tool2: null });
          return;
      }

      const itemObjects = await suiClient.multiGetObjects({
          ids: objectIds,
          options: { showContent: true, showType: true }
      });

      const itemsMap: Record<string, Item> = {};
      itemObjects.forEach((resp) => {
          const item = parseObjectData(resp);
          if (item && item.id) {
              itemsMap[item.id] = item as Item;
          }
      });

      setEquipment({
          weapon: slots["slot_weapon"] ? itemsMap[slots["slot_weapon"]] || null : null,
          armor: slots["slot_armor"] ? itemsMap[slots["slot_armor"]] || null : null,
          tool1: slots["slot_tool_1"] ? itemsMap[slots["slot_tool_1"]] || null : null,
          tool2: slots["slot_tool_2"] ? itemsMap[slots["slot_tool_2"]] || null : null,
      });

    } catch (e) {
      console.error("Error fetching NPC equipment:", e);
    } finally {
      setLoading(false);
    }
  }, [npcId]);

  useEffect(() => {
    if (npcId) {
      fetchEquipment();
    } else {
        setEquipment({ weapon: null, armor: null, tool1: null, tool2: null });
    }
  }, [npcId, fetchEquipment]);

  // Listen for global inventory/equipment update events
  useEffect(() => {
      const onInventoryUpdated = () => {
          if (npcId) fetchEquipment();
      };
      // We listen to the same event that InventoryModal emits
      window.addEventListener("inventory-updated", onInventoryUpdated);
      return () => window.removeEventListener("inventory-updated", onInventoryUpdated);
  }, [npcId, fetchEquipment]);

  return {
    equipment,
    loading,
    refresh: fetchEquipment
  };
}
