import { NETWORK, PACKAGE_ID } from "../constants";

export const queryKeys = {
  ownedRoot: (ownerAddress: string) => ["owned", NETWORK, PACKAGE_ID, ownerAddress] as const,

  bunkers: (ownerAddress: string) => ["owned", NETWORK, PACKAGE_ID, ownerAddress, "bunkers"] as const,
  npcs: (ownerAddress: string) => ["owned", NETWORK, PACKAGE_ID, ownerAddress, "npcs"] as const,
  items: (ownerAddress: string) => ["owned", NETWORK, PACKAGE_ID, ownerAddress, "items"] as const,
  blueprints: (ownerAddress: string) => ["owned", NETWORK, PACKAGE_ID, ownerAddress, "blueprints"] as const,
  
  // Single object keys
  bunker: (id: string) => ["object", NETWORK, PACKAGE_ID, "bunker", id] as const,
  npc: (id: string) => ["object", NETWORK, PACKAGE_ID, "npc", id] as const,
};
