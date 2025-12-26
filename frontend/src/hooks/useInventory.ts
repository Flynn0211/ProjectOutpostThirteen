import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import type { Item, NPC, Blueprint } from "../types";

export function useInventory(isOpen: boolean = true) {
    const account = useCurrentAccount();
    const [items, setItems] = useState<Item[]>([]);
    const [npcs, setNpcs] = useState<NPC[]>([]);
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchInventory = useCallback(async () => {
        if (!account?.address) return;
        
        setLoading(true);
        try {
            const [itemObjects, npcObjects, blueprintObjects] = await Promise.all([
                getOwnedObjects(account.address, getObjectType("item", "Item")),
                getOwnedObjects(account.address, getObjectType("npc", "NPC")),
                getOwnedObjects(account.address, getObjectType("crafting", "Blueprint")),
            ]);

            setItems((itemObjects as Item[]).filter((i) => !!i && !!(i as any).id));
            setNpcs((npcObjects as NPC[]).filter((n) => !!n && !!(n as any).id));
            setBlueprints((blueprintObjects as Blueprint[]).filter((b) => !!b && !!(b as any).id));
        } catch (e) {
            console.error("Error fetching inventory:", e);
        } finally {
            setLoading(false);
        }
    }, [account]);

    useEffect(() => {
        if (isOpen && account?.address) {
            fetchInventory();
        }
    }, [isOpen, account, fetchInventory]);

    // Listen for global inventory update events
    useEffect(() => {
        if (!isOpen) return;

        const onInventoryUpdated = () => fetchInventory();
        window.addEventListener("inventory-updated", onInventoryUpdated);
        return () => window.removeEventListener("inventory-updated", onInventoryUpdated);
    }, [isOpen, fetchInventory]);

    return {
        items,
        npcs,
        blueprints,
        loading,
        refresh: fetchInventory,
        removeItem: (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))
    };
}
