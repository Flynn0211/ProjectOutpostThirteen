import { useSuiClient } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useState, useCallback } from "react";
import { MARKETPLACE_OBJECT_ID, PACKAGE_ID } from "../constants";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui.js/utils";

export interface Listing {
  id: string;
  seller: string;
  price: string; // MIST
  listedAt: number;
  type: "item" | "npc" | "bundle";
  // Details depending on type
  details?: any; 
}

export function useMarketplace() {
  const client = useSuiClient();
  const [loading, setLoading] = useState(false);

  // --- Fetching ---

  const fetchListings = useCallback(async (type: "item" | "npc" | "bundle") => {
    if (MARKETPLACE_OBJECT_ID === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.warn("Marketplace ID not set");
        return [];
    }
    
    setLoading(true);
    try {
      // 1. Get Marketplace Object to find Table IDs
      const marketObj = await client.getObject({
        id: MARKETPLACE_OBJECT_ID,
        options: { showContent: true },
      });

      if (!marketObj.data?.content || marketObj.data.content.dataType !== "moveObject") {
        throw new Error("Invalid Marketplace Object");
      }

      const fields = marketObj.data.content.fields as any;
      let tableId;
      if (type === "item") tableId = fields.item_listings?.fields?.id?.id;
      else if (type === "npc") tableId = fields.npc_listings?.fields?.id?.id;
      else if (type === "bundle") tableId = fields.bundle_listings?.fields?.id?.id;

      if (!tableId) return [];

      // 2. Scan Table (Get Dynamic Fields)
      const dfs = await client.getDynamicFields({
        parentId: tableId,
      });

      const listingFieldIds = dfs.data.map((d) => d.objectId);
      if (listingFieldIds.length === 0) return [];

      const listingObjects = await client.multiGetObjects({
        ids: listingFieldIds,
        options: { showContent: true },
      });

      // 3. Parse Listings AND Collect Object IDs for secondary fetch
      const listingsData: Listing[] = [];
      const objectIdsToFetch: string[] = [];

      listingObjects.forEach((obj) => {
        const field = obj.data?.content as any;
        // field.fields.value is the ItemListing/NPCListing struct wrapper
        // The actual struct fields are in field.fields.value.fields
        if (!field || !field.fields || !field.fields.value) return;

        const value = field.fields.value.fields;
        const objectId = value.item_id || value.npc_id || value.id?.id;
        
        listingsData.push({
            id: objectId,
            seller: value.seller,
            price: value.price,
            listedAt: Number(value.listed_at),
            type,
            details: type === "bundle" ? value : undefined // Bundle details are inside the listing
        });

        if (type !== "bundle" && objectId) {
            objectIdsToFetch.push(objectId);
        }
      });

      // 4. Secondary Fetch for Item/NPC Details
      if (objectIdsToFetch.length > 0) {
          const detailObjects = await client.multiGetObjects({
              ids: objectIdsToFetch,
              options: { showContent: true, showDisplay: true }
          });

          // Create map for easy lookup
          const detailsMap = new Map();
          detailObjects.forEach((obj) => {
              if (obj.data?.objectId && obj.data?.content) {
                   detailsMap.set(obj.data.objectId, (obj.data.content as any).fields);
              }
          });

          // Merge details
          listingsData.forEach((listing) => {
              if (detailsMap.has(listing.id)) {
                  listing.details = detailsMap.get(listing.id);
                  // Ensure name/rarity are accessible top-level if needed, or just rely on details
              }
          });
      }

      return listingsData;
    } catch (e) {
      console.error("Error fetching listings:", e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [client]);

  // --- Actions ---

  const buyItem = async (listingId: string, price: string, signAndExecute: any) => {
    const tx = new TransactionBlock();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(price)]);
    
    tx.moveCall({
      target: `${PACKAGE_ID}::marketplace::buy_item`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(listingId),
        coin,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return signAndExecute({ transactionBlock: tx });
  };
  
  const buyNPC = async (listingId: string, price: string, signAndExecute: any) => {
    const tx = new TransactionBlock();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(price)]);
    
    tx.moveCall({
      target: `${PACKAGE_ID}::marketplace::buy_npc`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(listingId),
        coin,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return signAndExecute({ transactionBlock: tx });
  };

  const buyBundle = async (listingId: string, price: string, bunkerId: string, signAndExecute: any) => {
    const tx = new TransactionBlock();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(price)]);
    
    tx.moveCall({
      target: `${PACKAGE_ID}::marketplace::buy_resource_bundle`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(listingId),
        tx.object(bunkerId),
        coin,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return signAndExecute({ transactionBlock: tx });
  };

  const delistItem = async (listingId: string, signAndExecute: any) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${PACKAGE_ID}::marketplace::delist_item`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(listingId),
      ],
    });
    return signAndExecute({ transactionBlock: tx });
  };

  const delistNPC = async (listingId: string, signAndExecute: any) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${PACKAGE_ID}::marketplace::delist_npc`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(listingId),
      ],
    });
    return signAndExecute({ transactionBlock: tx });
  };

  const listItem = async (itemId: string, price: string, signAndExecute: any) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${PACKAGE_ID}::marketplace::list_item`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(itemId),
        tx.pure(price, "u64"), // Price in MIST
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    return signAndExecute({ transactionBlock: tx });
  };

  const listNPC = async (npcId: string, price: string, signAndExecute: any) => {
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${PACKAGE_ID}::marketplace::list_npc`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(npcId),
        tx.pure(price, "u64"), // Price in MIST
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    return signAndExecute({ transactionBlock: tx });
  };

  const batchList = async (items: { id: string; price: string; type: "item" | "npc" }[], signAndExecute: any) => {
    if (items.length === 0) return;
    const tx = new TransactionBlock();
    
    for (const item of items) {
        if (item.type === "item") {
            tx.moveCall({
                target: `${PACKAGE_ID}::marketplace::list_item`,
                arguments: [
                    tx.object(MARKETPLACE_OBJECT_ID),
                    tx.object(item.id),
                    tx.pure(item.price, "u64"), 
                    tx.object(SUI_CLOCK_OBJECT_ID),
                ],
            });
        } else {
            tx.moveCall({
                target: `${PACKAGE_ID}::marketplace::list_npc`,
                arguments: [
                    tx.object(MARKETPLACE_OBJECT_ID),
                    tx.object(item.id),
                    tx.pure(item.price, "u64"), 
                    tx.object(SUI_CLOCK_OBJECT_ID),
                ],
            });
        }
    }

    return signAndExecute({ transactionBlock: tx });
  };

  return {
    loading,
    fetchListings,
    buyItem,
    buyNPC,
    buyBundle,
    delistItem,
    delistNPC,
    listItem,
    listNPC,
    batchList, 
  };
}
