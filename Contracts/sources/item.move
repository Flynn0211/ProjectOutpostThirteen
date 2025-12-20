module contracts::item {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use contracts::utils;
    use sui::clock::Clock;

    // ============ Constants ============
    
    // Item types
    const TYPE_WEAPON: u8 = 1;
    const TYPE_ARMOR: u8 = 2;
    const TYPE_TOOL: u8 = 3;
    const TYPE_MEDICINE: u8 = 4;
    const TYPE_REVIVAL_POTION: u8 = 5;
    const TYPE_FOOD: u8 = 6;
    const TYPE_COLLECTIBLE: u8 = 99;
    
    // Rarity levels
    const RARITY_COMMON: u8 = 1;
    const RARITY_RARE: u8 = 2;
    const RARITY_EPIC: u8 = 3;
    const RARITY_LEGENDARY: u8 = 4;
    
    // ============ Structs ============
    
    /// Item object - vật phẩm hiếm có thể equip
     public struct Item has key, store {
        id: UID,
        name: String,
        rarity: u8,           // 1-4 (Common to Legendary)
        item_type: u8,        // 1-3 (Equip), 4-6 (Consumable), 99 (Collectible)
        hp_bonus: u64,        // Bonus HP
        attack_bonus: u64,    // Bonus Attack
        defense_bonus: u64,   // Bonus Defense
        luck_bonus: u64,      // Bonus Luck
    }
    
    // ============ Events ============
    
    public struct ItemCreated has copy, drop {
        item_id: ID,
        name: String,
        rarity: u8,
        item_type: u8,
        owner: address,
    }
    
    public struct ItemDestroyed has copy, drop {
        item_id: ID,
        name: String,
    }
    
    // ============ Functions ============
    
    /// Tạo item mới với rarity random
    public entry fun create_random_item(
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Roll rarity (1-100)
        let roll = utils::random_in_range(1, 101, clock, ctx);
        let rarity = if (roll <= 60) { RARITY_COMMON }
                     else if (roll <= 85) { RARITY_RARE }
                     else if (roll <= 97) { RARITY_EPIC }
                     else { RARITY_LEGENDARY };
        
        // Roll item type
        // Roll item type
        // 1-3: Equipable (Weapon/Armor/Tool) - 50%
        // 4-6: Consumable (Medicine/Revival Potion/Food) - 40%
        // 99: Collectible - 10%
        
        let type_roll = utils::random_in_range(1, 100, clock, ctx);
        let item_type = if (type_roll <= 50) {
            (utils::random_in_range(1, 3, clock, ctx) as u8)
        } else if (type_roll <= 90) {
            (utils::random_in_range(4, 6, clock, ctx) as u8)
        } else {
            TYPE_COLLECTIBLE
        };
        
        // Calculate stats dựa trên rarity
        let (hp, atk, def, luck) = calculate_item_stats(rarity, item_type, clock, ctx);
        
        // Generate name
        let name = generate_item_name(item_type, rarity);
        
        let item = Item {
            id: object::new(ctx),
            name,
            rarity,
            item_type,
            hp_bonus: hp,
            attack_bonus: atk,
            defense_bonus: def,
            luck_bonus: luck,
        };
        
        let sender = tx_context::sender(ctx);
        
        event::emit(ItemCreated {
            item_id: object::id(&item),
            name: item.name,
            rarity: item.rarity,
            item_type: item.item_type,
            owner: sender,
        });
        
        // Transfer to creator
        transfer::public_transfer(item, sender);
    }
    
    /// Destroy item (khi cần clean up hoặc dùng item)
    public entry fun destroy_item(item: Item) {
        let Item { id, name, rarity: _, item_type: _, hp_bonus: _, attack_bonus: _, defense_bonus: _, luck_bonus: _ } = item;
        
        event::emit(ItemDestroyed {
            item_id: object::uid_to_inner(&id),
            name,
        });
        
        object::delete(id);
    }
    
    // ============ Getters ============
    
    public fun get_total_bonus(item: &Item): (u64, u64, u64, u64) {
        (item.hp_bonus, item.attack_bonus, item.defense_bonus, item.luck_bonus)
    }
    
    public fun get_rarity(item: &Item): u8 {
        item.rarity
    }
    
    public fun get_hp_bonus(item: &Item): u64 {
        item.hp_bonus
    }
    
    public fun get_attack_bonus(item: &Item): u64 {
        item.attack_bonus
    }
    
    public fun get_defense_bonus(item: &Item): u64 {
        item.defense_bonus
    }
    
    public fun get_luck_bonus(item: &Item): u64 {
        item.luck_bonus
    }
    
    public fun get_item_type(item: &Item): u8 {
        item.item_type
    }
    
    public fun get_name(item: &Item): String {
        item.name
    }

    public fun type_revival_potion(): u8 {
        TYPE_REVIVAL_POTION
    }

    public fun type_food(): u8 {
        TYPE_FOOD
    }

    public fun type_collectible(): u8 {
        TYPE_COLLECTIBLE
    }
    
    // ============ Internal Helpers ============
    
    /// Tính stats cho item dựa trên rarity và type
    fun calculate_item_stats(
        rarity: u8,
        item_type: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ): (u64, u64, u64, u64) {
        // Base stats theo rarity
        let base = if (rarity == RARITY_COMMON) { 10 }
                   else if (rarity == RARITY_RARE) { 25 }
                   else if (rarity == RARITY_EPIC) { 50 }
                   else { 100 }; // Legendary
        
        // Phân bổ stats theo item type
        let (hp, atk, def, luck) = if (item_type == TYPE_WEAPON) {
            (0, base * 2, 0, base / 2)
        } else if (item_type == TYPE_ARMOR) {
            (base, 0, base * 2, 0)
        } else if (item_type == TYPE_TOOL) {
            (0, base / 2, base / 2, base * 2)
        } else if (item_type == TYPE_MEDICINE) {
            (base * 3, 0, 0, 0)
        } else if (item_type == TYPE_FOOD) {
            (base, 0, 0, 0) // Food gives small HP bonus if equipped (or useless)
        } else { // TYPE_REVIVAL_POTION, TYPE_COLLECTIBLE
            (0, 0, 0, 0) // No passive stats
        };
        
        // Add random variance +/- 20% ONLY if stat > 0
        let variance = (base * 20 / 100);
        let hp_final = if (hp > 0) { hp + utils::random_in_range(0, variance, clock, ctx) } else { 0 };
        let atk_final = if (atk > 0) { atk + utils::random_in_range(0, variance, clock, ctx) } else { 0 };
        let def_final = if (def > 0) { def + utils::random_in_range(0, variance, clock, ctx) } else { 0 };
        let luck_final = if (luck > 0) { luck + utils::random_in_range(0, variance, clock, ctx) } else { 0 };
        
        (hp_final, atk_final, def_final, luck_final)
    }
    
    fun generate_item_name(item_type: u8, rarity: u8): String {
        let mut rarity_name = if (rarity == RARITY_LEGENDARY) { string::utf8(b"Legendary") }
                         else if (rarity == RARITY_EPIC) { string::utf8(b"Epic") }
                         else if (rarity == RARITY_RARE) { string::utf8(b"Rare") }
                         else { string::utf8(b"Common") };
        
        let type_name = if (item_type == TYPE_WEAPON) { string::utf8(b" Weapon") }
                       else if (item_type == TYPE_ARMOR) { string::utf8(b" Armor") }
                       else if (item_type == TYPE_TOOL) { string::utf8(b" Tool") }
                       else if (item_type == TYPE_MEDICINE) { string::utf8(b" Medicine") }
                       else if (item_type == TYPE_REVIVAL_POTION) { string::utf8(b" Revival Potion") }
                       else if (item_type == TYPE_FOOD) { string::utf8(b" Food") }
                       else { string::utf8(b" Artifact") }; // Collectible
        
        string::append(&mut rarity_name, type_name);
        rarity_name
    }
}
