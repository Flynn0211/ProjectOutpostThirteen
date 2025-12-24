import { IMAGES, ITEM_TYPES, RARITY } from "../constants";

// Get image URL for item based on type and rarity
export function getItemImageUrl(itemType: number, rarity: number): string {
  const rarityIndex = Math.min(rarity, RARITY.MYTHIC);
  
  switch (itemType) {
    case ITEM_TYPES.WEAPON:
      return IMAGES.weapon[rarityIndex % IMAGES.weapon.length];
    case ITEM_TYPES.ARMOR:
      return IMAGES.armor[rarityIndex % IMAGES.armor.length];
    case ITEM_TYPES.TOOL:
      return IMAGES.tool[rarityIndex % IMAGES.tool.length];
    case ITEM_TYPES.MEDICINE:
      return IMAGES.medicine[rarityIndex % IMAGES.medicine.length];
    case ITEM_TYPES.REVIVAL_POTION:
      return IMAGES.revivalPotion[0];
    case ITEM_TYPES.FOOD:
      return IMAGES.food[rarityIndex % IMAGES.food.length];
    case ITEM_TYPES.COLLECTIBLE:
      return IMAGES.collectible[rarityIndex % IMAGES.collectible.length];
    default:
      return IMAGES.collectible[0];
  }
}

// Get room image URL
export function getRoomImageUrl(roomType: number): string {
  const index = roomType % IMAGES.room.length;
  return IMAGES.room[index];
}

// Get NPC sprite URL (randomly assigned based on rarity)
export function getNPCSpriteUrl(rarity: number, profession: number): string {
  const index = (rarity * 5 + profession) % IMAGES.npc.length;
  return IMAGES.npc[index];
}

// Get blueprint image
export function getBlueprintImageUrl(): string {
  return IMAGES.blueprint[0];
}

