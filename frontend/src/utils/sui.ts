import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { PACKAGE_ID, NETWORK } from "../constants";

const getRpcUrl = () => {
  if (import.meta.env.DEV) {
    return NETWORK === "testnet" ? "/sui-testnet" : "/sui-mainnet";
  }
  return getFullnodeUrl(NETWORK);
};

// Create Sui client
export const suiClient = new SuiClient({
  url: getRpcUrl(),
});

// Helper to get function name
export function getFunctionName(module: string, functionName: string): string {
  return `${PACKAGE_ID}::${module}::${functionName}`;
}

// Helper to get object type
export function getObjectType(module: string, structName: string): string {
  return `${PACKAGE_ID}::${module}::${structName}`;
}

// Parse object data
export function parseObjectData(data: any): any {
  if (!data) return null;

  // Sui SDK returns { data: { objectId, content: { dataType, fields } }}
  const obj = data.data ?? data;
  const content = obj.content ?? obj.data ?? obj;

  const isMoveObject = content?.dataType === "moveObject" || obj?.dataType === "moveObject";
  if (!isMoveObject) return null;

  const fields = content?.fields ?? obj?.fields ?? {};
  const objectId = obj?.objectId ?? content?.objectId ?? obj?.id ?? obj?.object_id;

  if (!objectId) return null;

  // Normalize nested complex fields (e.g., vector<Room>) to plain objects
  const normalize = (val: any): any => {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) {
      return val
        .map((it) => normalize(it))
        .filter((v) => v !== undefined);
    }
    if (typeof val === "object") {
      const inner = (val as any).fields ?? val;
      const out: any = {};
      for (const k of Object.keys(inner)) {
        out[k] = normalize((inner as any)[k]);
      }
      return out;
    }
    // Convert string numbers to numbers when possible
    if (typeof val === "string" && /^\d+$/.test(val)) return Number(val);
    return val;
  };

  const normalizedFields = normalize(fields);

  // Special case: rooms vector normalization
  if (normalizedFields?.rooms && Array.isArray(normalizedFields.rooms)) {
    normalizedFields.rooms = normalizedFields.rooms.map((r: any) => ({
      room_type: Number(r.room_type ?? r.roomType ?? 0),
      level: Number(r.level ?? 1),
      capacity: Number(r.capacity ?? 0),
      efficiency: Number(r.efficiency ?? 0),
      assigned_npcs: Number(r.assigned_npcs ?? r.assignedNpcs ?? 0),
      production_rate: Number(r.production_rate ?? r.productionRate ?? 0),
      last_collected_at: Number(r.last_collected_at ?? r.lastCollectedAt ?? 0),
      accumulated: Number(r.accumulated ?? 0),
      production_remainder: Number(r.production_remainder ?? r.productionRemainder ?? 0),
    }));
  }

  // IMPORTANT:
  // Move objects usually have a field named `id` which is a UID struct (e.g. { id: "0x..." }).
  // If we spread fields after setting `id`, it overwrites the real Sui objectId and breaks tx.object(...).
  // Keep the real object id as `id`, and drop the Move UID field to avoid confusion.
  const { id: _moveUid, ...restFields } = normalizedFields ?? {};

  return {
    ...restFields,
    id: objectId,
  };
}

// Get owned objects by type
export async function getOwnedObjects(
  address: string,
  objectType: string
): Promise<any[]> {
  try {
    const objects = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: objectType,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });
    
    return objects.data
      .map((obj: any) => parseObjectData(obj))
      .filter(Boolean);
  } catch (error) {
    console.error("Error fetching owned objects:", error);
    return [];
  }
}

// Strict variant for React Query: propagate errors so cached data isn't replaced by [].
export async function getOwnedObjectsStrict(
  address: string,
  objectType: string
): Promise<any[]> {
  const objects = await suiClient.getOwnedObjects({
    owner: address,
    filter: {
      StructType: objectType,
    },
    options: {
      showContent: true,
      showType: true,
    },
  });

  return objects.data
    .map((obj: any) => parseObjectData(obj))
    .filter(Boolean);
}

// Get object by ID
export async function getObject(objectId: string): Promise<any> {
  try {
    const object = await suiClient.getObject({
      id: objectId,
      options: {
        showContent: true,
        showType: true,
      },
    });
    
    return parseObjectData(object);
  } catch (error) {
    console.error("Error fetching object:", error);
    return null;
  }
}

