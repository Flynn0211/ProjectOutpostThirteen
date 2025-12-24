// Type definitions for game objects

export interface Bunker {
  id: string;
  owner: string;
  name: string;
  level: number;
  capacity: number;
  current_npcs: number;
  food: number;
  water: number;
  scrap: number;
  power_generation: number;
  power_consumption: number;
  rooms: Room[];
}

export interface Room {
  room_type: number;
  level: number;
  capacity: number;
  efficiency: number;
  assigned_npcs: number;
  production_rate: number;
  last_collected_at: number;
  accumulated: number;
}

export interface NPC {
  id: string;
  rarity: number;
  profession: number;
  level: number;
  max_hp: number;
  current_hp: number;
  max_stamina: number;
  current_stamina: number;
  hunger: number;
  thirst: number;
  skills: number[];
  skill_points: number;
  respec_count: number;
  owner: string;
  name: string;
  status: number;
  knocked_at: number;
  inventory_count: number;
  assigned_room?: number;
  work_started_at: number;
  strength: number;
}

export interface Item {
  id: string;
  name: string;
  rarity: number;
  item_type: number;
  durability: number;
  max_durability: number;
  hp_bonus: number;
  attack_bonus: number;
  defense_bonus: number;
  luck_bonus: number;
  owner?: string;
}

export interface Blueprint {
  id: string;
  item_type: number;
  rarity: number;
  uses_remaining: number;
  max_uses: number;
}

export interface MarketplaceListing {
  id: string;
  seller: string;
  price: number;
  listed_at: number;
}

