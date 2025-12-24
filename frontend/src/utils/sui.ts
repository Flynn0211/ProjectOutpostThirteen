import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { PACKAGE_ID, NETWORK } from "../constants";

// Create Sui client
export const suiClient = new SuiClient({
  url: getFullnodeUrl(NETWORK),
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
  if (!data || !data.data) return null;
  
  if (data.data.dataType === "moveObject") {
    return {
      id: data.data.objectId,
      ...data.data.fields,
    };
  }
  
  return null;
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
    
    return objects.data.map((obj: any) => parseObjectData(obj));
  } catch (error) {
    console.error("Error fetching owned objects:", error);
    return [];
  }
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

