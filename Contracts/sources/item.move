module contracts::item {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::option::{Self as option, Option};
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
    const TYPE_WATER: u8 = 7;
    const TYPE_CLOTH: u8 = 8;
    const TYPE_BANDAGE: u8 = 9;
    const TYPE_COLLECTIBLE: u8 = 99;
    
    // Rarity levels
    const RARITY_COMMON: u8 = 1;
    const RARITY_RARE: u8 = 2;
    const RARITY_EPIC: u8 = 3;
    const RARITY_LEGENDARY: u8 = 4;
    
    // ============ PHASE 3: Độ Bền (Durability) ============
    
    // Độ bền tối đa theo độ hiếm
    const DURABILITY_COMMON: u64 = 100;       // Phổ thông
    const DURABILITY_RARE: u64 = 200;         // Hiếm
    const DURABILITY_EPIC: u64 = 300;         // Sử thi
    const DURABILITY_LEGENDARY: u64 = 500;     // Huyền thoại
    
    // Tốc độ giảm độ bền (theo kết quả thám hiểm)
    const DECAY_CRITICAL_SUCCESS: u64 = 1;     // Thắng lớn: -1
    const DECAY_SUCCESS: u64 = 2;              // Thắng: -2
    const DECAY_PARTIAL_SUCCESS: u64 = 3;      // Thắng một phần: -3
    const DECAY_FAILURE: u64 = 5;              // Thua: -5
    const DECAY_CRITICAL_FAILURE: u64 = 10;    // Thua thảm: -10
    
    // Chi phí sửa chữa
    // NOTE: V2 repair cost is computed dynamically by rarity/level.
    
    // Mã lỗi
    const E_ITEM_NOT_DAMAGED: u64 = 1000;      // Vật phẩm chưa hỏng
    const E_NOT_OWNER: u64 = 1002;             // Không phải chủ sở hữu
    const E_INSUFFICIENT_PAYMENT: u64 = 1003;  // Không đủ thanh toán
    const E_WORKSHOP_REQUIRED: u64 = 1004;
    const E_WORKSHOP_NO_POWER: u64 = 1005;

    fun rarity_repair_coef(rarity: u8): u64 {
        if (rarity == RARITY_COMMON) {
            1
        } else if (rarity == RARITY_RARE) {
            2
        } else if (rarity == RARITY_EPIC) {
            5
        } else if (rarity == RARITY_LEGENDARY) {
            15
        } else {
            1
        }
    }

    // Item level is not currently stored on-chain; default to 1 to keep struct layout stable.
    fun item_level(_item: &Item): u64 { 1 }

    public fun get_rating(item: &Item): u64 {
        let level = item_level(item);
        (level * 10) + ((item.rarity as u64) * 50)
    }

    fun ceil_div(n: u64, d: u64): u64 {
        (n + (d - 1)) / d
    }

    public fun compute_repair_scrap_cost(item: &Item, engineer_discount_pct: u64): u64 {
        let durability_lost = item.max_durability - item.durability;
        let coef = rarity_repair_coef(item.rarity);
        let mut cost = durability_lost * coef;

        // levelCoef = 1 + level/10 => (10 + level) / 10
        let level = item_level(item);
        cost = ceil_div(cost * (10 + level), 10);

        // Broken penalty: +20%
        if (item.durability == 0) {
            cost = ceil_div(cost * 120, 100);
        };

        if (engineer_discount_pct > 0 && engineer_discount_pct < 100) {
            cost = (cost * (100 - engineer_discount_pct)) / 100;
        };

        cost
    }
    
    // ============ Structs ============
    
    /// Vật phẩm - có thể trang bị hoặc tiêu hao
    public struct Item has key, store {
        id: UID,
        name: String,
        rarity: u8,           // Độ hiếm: 1-4 (Common → Legendary)
        item_type: u8,        // Loại: 1-3 (Trang bị), 4-6 (Tiêu hao), 99 (Sưu tầm)
        
        // Phase 3: Hệ thống độ bền
        durability: u64,      // Độ bền hiện tại (0 = hỏng)
        max_durability: u64,  // Độ bền tối đa (dựa vào rarity)
        
        // Chỉ số tăng thêm
        hp_bonus: u64,        // Tăng máu
        attack_bonus: u64,    // Tăng tấn công
        defense_bonus: u64,   // Tăng phòng thủ
        luck_bonus: u64,      // Tăng may mắn
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
        // Roll rarity (1-100) - BUFFED RATES
        let roll = utils::random_in_range(1, 101, clock, ctx);
        let rarity = if (roll <= 50) { RARITY_COMMON }       // 50%
                     else if (roll <= 80) { RARITY_RARE }    // 30%
                     else if (roll <= 95) { RARITY_EPIC }    // 15%
                     else { RARITY_LEGENDARY };              // 5%
        
        
        // Roll item type - UPDATED RATIOS (High Chance for Equipment)
        // 1-3: Equipable (Weapon/Armor/Tool) - 70% (was 50%)
        // 4-7: Consumable (Medicine/Revival Potion/Food/Water) - 20% (was 40%)
        // 99: Collectible - 10%
        
        let type_roll = utils::random_in_range(1, 100, clock, ctx);
        let item_type = if (type_roll <= 70) {
            (utils::random_in_range(1, 3, clock, ctx) as u8)
        } else if (type_roll <= 90) {
            (utils::random_in_range(4, 7, clock, ctx) as u8)
        } else {
            TYPE_COLLECTIBLE
        };
        
        // Calculate stats dựa trên rarity
        let (hp, atk, def, luck) = calculate_item_stats(rarity, item_type, clock, ctx);
        
        // Generate name
        let name = generate_item_name(item_type, rarity);
        
        // Phase 3: Calculate max durability
        let max_dur = get_max_durability_for_rarity(rarity);
        
        let item = Item {
            id: object::new(ctx),
            name,
            rarity,
            item_type,
            durability: max_dur,      // Start at full
            max_durability: max_dur,
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

    /// Tạo item với seed (để dùng trong loop tránh trùng lặp)
    public entry fun create_loot_item(
        seed: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Roll rarity (1-100) - USE SEED - BUFFED RATES
        let roll = utils::random_in_range_with_seed(1, 101, seed, clock, ctx);
        let rarity = if (roll <= 50) { RARITY_COMMON }       // 50%
                     else if (roll <= 80) { RARITY_RARE }    // 30%
                     else if (roll <= 95) { RARITY_EPIC }    // 15%
                     else { RARITY_LEGENDARY };              // 5%
        
        // Roll item type - USE SEED + 1 - HIGH EQUIPMENT CHANCE (70%)
        let type_roll = utils::random_in_range_with_seed(1, 100, seed + 1, clock, ctx);
        let item_type = if (type_roll <= 70) {
            (utils::random_in_range_with_seed(1, 3, seed + 2, clock, ctx) as u8)
        } else if (type_roll <= 90) {
            (utils::random_in_range_with_seed(4, 7, seed + 3, clock, ctx) as u8)
        } else {
            TYPE_COLLECTIBLE
        };
        
        // Calculate stats dựa trên rarity
        let (hp, atk, def, luck) = calculate_item_stats(rarity, item_type, clock, ctx); // Note: calculate_item_stats vẫn dùng RNG thường, nhưng không quan trọng lắm cho stats variance
        
        // Generate name
        let name = generate_item_name(item_type, rarity);
        
        // Phase 3: Calculate max durability
        let max_dur = get_max_durability_for_rarity(rarity);
        
        let item = Item {
            id: object::new(ctx),
            name,
            rarity,
            item_type,
            durability: max_dur,      // Start at full
            max_durability: max_dur,
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
    
    /// Phase 3: Create item with specific params (for crafting)
    public fun create_item_with_params(
        item_type: u8,
        rarity: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ): Item {
        // Calculate stats dựa trên rarity và type
        let (hp, atk, def, luck) = calculate_item_stats(rarity, item_type, clock, ctx);
        
        // Generate name
        let name = generate_item_name(item_type, rarity);
        
        // Calculate max durability
        let max_dur = get_max_durability_for_rarity(rarity);
        
        let item = Item {
            id: object::new(ctx),
            name,
            rarity,
            item_type,
            durability: max_dur,
            max_durability: max_dur,
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
        
        item  // Return item instead of transferring
    }
    
    /// Destroy item (khi cần clean up hoặc dùng item)
    public entry fun destroy_item(item: Item) {
        let Item { id, name, rarity: _, item_type: _, durability: _, max_durability: _, hp_bonus: _, attack_bonus: _, defense_bonus: _, luck_bonus: _ } = item;
        
        event::emit(ItemDestroyed {
            item_id: object::uid_to_inner(&id),
            name,
        });
        
        object::delete(id);
    }

    public fun create_cloth(ctx: &mut TxContext): Item {
        let rarity = RARITY_COMMON;
        let item_type = TYPE_CLOTH;
        let max_dur = get_max_durability_for_rarity(rarity);
        Item {
            id: object::new(ctx),
            name: generate_item_name(item_type, rarity),
            rarity,
            item_type,
            durability: max_dur,
            max_durability: max_dur,
            hp_bonus: 0,
            attack_bonus: 0,
            defense_bonus: 0,
            luck_bonus: 0,
        }
    }

    public fun create_bandage(ctx: &mut TxContext): Item {
        let rarity = RARITY_COMMON;
        let item_type = TYPE_BANDAGE;
        let max_dur = get_max_durability_for_rarity(rarity);
        Item {
            id: object::new(ctx),
            name: generate_item_name(item_type, rarity),
            rarity,
            item_type,
            durability: max_dur,
            max_durability: max_dur,
            hp_bonus: 0,
            attack_bonus: 0,
            defense_bonus: 0,
            luck_bonus: 0,
        }
    }
    
    // ============ PHASE 3: Durability Functions ============
    
    /// Reduce durability after expedition
    public fun reduce_durability(item: &mut Item, outcome: u8) {
        let decay = if (outcome == 0) {
            DECAY_CRITICAL_SUCCESS
        } else if (outcome == 1) {
            DECAY_SUCCESS
        } else if (outcome == 2) {
            DECAY_PARTIAL_SUCCESS
        } else if (outcome == 3) {
            DECAY_FAILURE
        } else {
            DECAY_CRITICAL_FAILURE
        };
        
        if (item.durability > decay) {
            item.durability = item.durability - decay;
        } else {
            item.durability = 0;  // Broken
        };
    }
    
    /// Check if item is broken
    public fun is_broken(item: &Item): bool {
        item.durability == 0
    }
    
    /// Get effective bonuses (0 if broken)
    public fun get_effective_attack(item: &Item): u64 {
        if (is_broken(item)) { 0 } else { item.attack_bonus }
    }
    
    public fun get_effective_defense(item: &Item): u64 {
        if (is_broken(item)) { 0 } else { item.defense_bonus }
    }
    
    public fun get_effective_hp(item: &Item): u64 {
        if (is_broken(item)) { 0 } else { item.hp_bonus }
    }
    
    public fun get_effective_luck(item: &Item): u64 {
        if (is_broken(item)) { 0 } else { item.luck_bonus }
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
    
    // Phase 3: Durability getters
    public fun get_durability(item: &Item): u64 { item.durability }
    public fun get_max_durability(item: &Item): u64 { item.max_durability }
    public fun set_durability_to_max(item: &mut Item) { item.durability = item.max_durability; }
    public fun get_durability_percent(item: &Item): u64 {
        if (item.max_durability == 0) { 0 }
        else { (item.durability * 100) / item.max_durability }
    }

    public fun type_weapon(): u8 { TYPE_WEAPON }
    public fun type_armor(): u8 { TYPE_ARMOR }
    public fun type_tool(): u8 { TYPE_TOOL }
    public fun type_revival_potion(): u8 {
        TYPE_REVIVAL_POTION
    }

    public fun type_medicine(): u8 {
        TYPE_MEDICINE
    }

    public fun type_food(): u8 {
        TYPE_FOOD
    }

    public fun type_water(): u8 {
        TYPE_WATER
    }

    public fun type_cloth(): u8 {
        TYPE_CLOTH
    }

    public fun type_bandage(): u8 {
        TYPE_BANDAGE
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
        } else if (item_type == TYPE_WATER) {
            (0, 0, 0, 0)
        } else { // TYPE_REVIVAL_POTION, TYPE_CLOTH, TYPE_BANDAGE, TYPE_COLLECTIBLE
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
                       else if (item_type == TYPE_WATER) { string::utf8(b" Water") }
                       else if (item_type == TYPE_CLOTH) { string::utf8(b" Cloth") }
                       else if (item_type == TYPE_BANDAGE) { string::utf8(b" Bandage") }
                       else { string::utf8(b" Artifact") }; // Collectible
        
        string::append(&mut rarity_name, type_name);
        rarity_name
    }
    
    // Phase 3: Helper for durability
    fun get_max_durability_for_rarity(rarity: u8): u64 {
        if (rarity == RARITY_COMMON) {
            DURABILITY_COMMON
        } else if (rarity == RARITY_RARE) {
            DURABILITY_RARE
        } else if (rarity == RARITY_EPIC) {
            DURABILITY_EPIC
        } else {
            DURABILITY_LEGENDARY
        }
    }
}
