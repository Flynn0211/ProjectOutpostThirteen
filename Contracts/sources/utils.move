// Module: utils
// Mô tả: Module tiện ích cung cấp constants, pseudo-random generation, và event definitions
// Module này là nền tảng cho toàn bộ hệ thống game

#[allow(unused_const)]
module contracts::utils {
    use sui::tx_context::TxContext;
    use sui::clock::{Self as clock, Clock};
    use sui::event;
    use std::vector;
    use std::hash;
    use sui::bcs;

    // ==================== CONSTANTS - HỆ THỐNG RARITY ====================
    // Các tier rarity từ thấp đến cao
    const RARITY_COMMON: u8 = 0;      // Phổ biến (70%)
    const RARITY_UNCOMMON: u8 = 1;    // Không phổ biến (20%)
    const RARITY_RARE: u8 = 2;        // Hiếm (7%)
    const RARITY_EPIC: u8 = 3;        // Sử thi (2%)
    const RARITY_LEGENDARY: u8 = 4;   // Huyền thoại (0.9%)
    const RARITY_MYTHIC: u8 = 5;      // Thần thoại (0.1%)

    // Ngưỡng để roll rarity (dựa trên số 0-999)
    const RARITY_THRESHOLD_UNCOMMON: u64 = 700;   // 0-699 = Common
    const RARITY_THRESHOLD_RARE: u64 = 900;       // 700-899 = Uncommon
    const RARITY_THRESHOLD_EPIC: u64 = 970;       // 900-969 = Rare
    const RARITY_THRESHOLD_LEGENDARY: u64 = 990;  // 970-989 = Epic
    const RARITY_THRESHOLD_MYTHIC: u64 = 999;     // 990-998 = Legendary, 999 = Mythic

    // ==================== CONSTANTS - NGHỀ NGHIỆP ====================
    const PROFESSION_SCAVENGER: u8 = 0;  // Người tìm kiếm (+resource)
    const PROFESSION_ENGINEER: u8 = 1;   // Kỹ sư (+bunker efficiency)
    const PROFESSION_MEDIC: u8 = 2;      // Bác sĩ (-risk, +healing)
    const PROFESSION_GUARD: u8 = 3;      // Lính canh (+combat)
    const PROFESSION_TRADER: u8 = 4;     // Thương nhân (+trading bonus)

    // ==================== CONSTANTS - LOẠI VẬT PHẨM ====================
    const ITEM_TYPE_WEAPON: u8 = 0;      // Vũ khí (+combat skill)
    const ITEM_TYPE_ARMOR: u8 = 1;       // Giáp (+HP)
    const ITEM_TYPE_TOOL: u8 = 2;        // Công cụ (+expedition success)
    const ITEM_TYPE_MEDICINE: u8 = 3;    // Thuốc (+healing)

    // ==================== CONSTANTS - LOẠI PHÒNG ====================
    const ROOM_TYPE_LIVING_QUARTERS: u8 = 0;  // Phòng ở
    const ROOM_TYPE_STORAGE: u8 = 1;          // Kho
    const ROOM_TYPE_GENERATOR: u8 = 2;        // Máy phát điện
    const ROOM_TYPE_MEDBAY: u8 = 3;          // Phòng y tế
    const ROOM_TYPE_WORKSHOP: u8 = 4;        // Xưởng

    // ==================== CONSTANTS - GIÁ TRỊ GAME ====================
    const RECRUIT_COST_MIST: u64 = 100_000_000;  // 0.1 SUI = 100 triệu MIST
    const BASE_EXPEDITION_DURATION: u64 = 3600000; // 1 giờ tính bằng milliseconds
    
    // Stat ranges theo rarity (min, max)
    // Common: HP 80-100, Stamina 80-100
    const COMMON_HP_MIN: u64 = 80;
    const COMMON_HP_MAX: u64 = 100;
    const COMMON_STAMINA_MIN: u64 = 80;
    const COMMON_STAMINA_MAX: u64 = 100;
    
    // Uncommon: HP 100-110, Stamina 100-110
    const UNCOMMON_HP_MIN: u64 = 100;
    const UNCOMMON_HP_MAX: u64 = 110;
    const UNCOMMON_STAMINA_MIN: u64 = 100;
    const UNCOMMON_STAMINA_MAX: u64 = 110;
    
    // Rare: HP 110-130, Stamina 110-130
    const RARE_HP_MIN: u64 = 110;
    const RARE_HP_MAX: u64 = 130;
    const RARE_STAMINA_MIN: u64 = 110;
    const RARE_STAMINA_MAX: u64 = 130;
    
    // Epic: HP 140-170, Stamina 140-170
    const EPIC_HP_MIN: u64 = 140;
    const EPIC_HP_MAX: u64 = 170;
    const EPIC_STAMINA_MIN: u64 = 140;
    const EPIC_STAMINA_MAX: u64 = 170;
    
    // Legendary: HP 180-220, Stamina 180-220
    const LEGENDARY_HP_MIN: u64 = 180;
    const LEGENDARY_HP_MAX: u64 = 220;
    const LEGENDARY_STAMINA_MIN: u64 = 180;
    const LEGENDARY_STAMINA_MAX: u64 = 220;
    
    // Mythic: HP 230-280, Stamina 230-280
    const MYTHIC_HP_MIN: u64 = 230;
    const MYTHIC_HP_MAX: u64 = 280;
    const MYTHIC_STAMINA_MIN: u64 = 230;
    const MYTHIC_STAMINA_MAX: u64 = 280;

    // ==================== ERROR CODES ====================
    const E_INVALID_RARITY: u64 = 1;
    const E_INVALID_PROFESSION: u64 = 2;
    const E_INVALID_RANGE: u64 = 3;

    // ==================== EVENTS ====================
    
    /// Event khi recruit NPC mới
    public struct RecruitEvent has copy, drop {
        npc_id: address,
        owner: address,
        rarity: u8,
        profession: u8,
        max_hp: u64,
        stamina: u64,
        timestamp: u64,
    }

    /// Event khi bắt đầu expedition
    public struct ExpeditionStartEvent has copy, drop {
        npc_id: address,
        owner: address,
        duration: u64,
        timestamp: u64,
    }

    /// Event khi expedition kết thúc
    public struct ExpeditionResultEvent has copy, drop {
        npc_id: address,
        owner: address,
        success: bool,
        resources_gained: u64,
        items_gained: u64,
        damage_taken: u64,
        timestamp: u64,
    }

    /// Event khi NPC level up
    public struct LevelUpEvent has copy, drop {
        npc_id: address,
        owner: address,
        new_level: u64,
        new_max_hp: u64,
        new_stamina: u64,
        timestamp: u64,
    }

    /// Event khi NPC chết vĩnh viễn
    public struct DeathEvent has copy, drop {
        npc_id: address,
        owner: address,
        rarity: u8,
        level: u64,
        cause: vector<u8>, // "expedition_failure", "starvation", etc.
        timestamp: u64,
    }

    /// Event khi equip/unequip item
    public struct EquipEvent has copy, drop {
        npc_id: address,
        item_id: address,
        equipped: bool, // true = equip, false = unequip
        timestamp: u64,
    }

    /// Event khi nâng cấp bunker
    public struct BunkerUpgradeEvent has copy, drop {
        bunker_id: address,
        owner: address,
        new_level: u64,
        new_capacity: u64,
        timestamp: u64,
    }

    // ==================== PSEUDO-RANDOM GENERATION ====================
    
    /**
     * Tạo số ngẫu nhiên pseudo-random từ transaction context và clock
     * 
     * CƠ CHẾ HOẠT ĐỘNG:
     * - Kết hợp 3 nguồn: TX digest (unique mỗi transaction) + timestamp (thời gian thực) + sender address
     * - Hash tất cả bằng SHA3-256 để tạo seed không đoán trước được
     * - Chuyển 8 bytes đầu thành số u64
     * 
     * LƯU Ý BẢO MẬT:
     * - Đây là pseudo-random, phù hợp cho hackathon/gaming nhưng KHÔNG an toàn cho production
     * - Validator có thể ảnh hưởng timestamp (vài ms) nhưng không đáng kể
     * - Không dùng cho financial applications hoặc high-value randomness
     * 
     * CÁCH SỬ DỤNG:
     * ```
     * let random_number = generate_random_u64(clock, ctx);
     * // random_number là số u64 từ 0 đến max u64
     * ```
     */
    public fun generate_random_u64(clock: &Clock, ctx: &mut TxContext): u64 {
        // Lấy 3 nguồn entropy
        let tx_digest = tx_context::digest(ctx);      // Unique cho mỗi TX (~32 bytes)
        let timestamp = clock::timestamp_ms(clock);   // Thời gian hiện tại (ms)
        let sender = tx_context::sender(ctx);         // Địa chỉ người gọi
        
        // Ghép tất cả thành 1 mảng bytes
        let mut seed_data = vector::empty<u8>();
        vector::append(&mut seed_data, *tx_digest);              // ~32 bytes
        vector::append(&mut seed_data, bcs::to_bytes(&timestamp)); // 8 bytes
        vector::append(&mut seed_data, bcs::to_bytes(&sender));    // 32 bytes
        // Tổng: ~72 bytes seed data
        
        // Hash để tạo số ngẫu nhiên (SHA3-256 = 32 bytes output)
        let hash_result = hash::sha3_256(seed_data);
        
        // Chuyển 8 bytes đầu thành u64
        let mut result: u64 = 0;
        let mut i = 0;
        while (i < 8) {
            // Mỗi byte nhân 256 rồi cộng byte tiếp theo
            result = result * 256 + (*vector::borrow(&hash_result, i) as u64);
            i = i + 1;
        };
        
        result
    }

    /**
     * Tạo số ngẫu nhiên trong khoảng [min, max] (bao gồm cả min và max)
     * 
     * CÁCH HOẠT ĐỘNG:
     * - Gọi generate_random_u64() để lấy số ngẫu nhiên lớn
     * - Dùng modulo để đưa về khoảng mong muốn
     * 
     * VÍ DỤ:
     * ```
     * let dice = random_in_range(1, 6, clock, ctx);  // Xúc xắc 1-6
     * let percent = random_in_range(0, 100, clock, ctx);  // Phần trăm 0-100
     * ```
     */
    public fun random_in_range(min: u64, max: u64, clock: &Clock, ctx: &mut TxContext): u64 {
        assert!(max >= min, E_INVALID_RANGE);
        
        if (max == min) {
            return min
        };
        
        let random = generate_random_u64(clock, ctx);
        let range = max - min + 1;  // +1 vì bao gồm cả max
        min + (random % range)      // Modulo đưa về khoảng [0, range), rồi cộng min
    }

    /**
     * Roll rarity dựa trên phân phối xác suất
     * 
     * HỆ THỐNG RARITY:
     * - Common (0):    70.0% - Phổ biến nhất
     * - Uncommon (1):  20.0% - Không phổ biến
     * - Rare (2):       7.0% - Hiếm
     * - Epic (3):       2.0% - Sử thi
     * - Legendary (4):  0.9% - Huyền thoại
     * - Mythic (5):     0.1% - Thần thoại (cực hiếm!)
     * 
     * CƠ CHẾ:
     * - Roll số từ 0-999 (1000 khả năng)
     * - 0-699 = Common (700 trường hợp = 70%)
     * - 700-899 = Uncommon (200 trường hợp = 20%)
     * - 900-969 = Rare (70 trường hợp = 7%)
     * - 970-989 = Epic (20 trường hợp = 2%)
     * - 990-998 = Legendary (9 trường hợp = 0.9%)
     * - 999 = Mythic (1 trường hợp = 0.1%)
     * 
     * CÁCH DÙNG:
     * ```
     * let rarity = roll_rarity(clock, ctx);
     * if (rarity == utils::rarity_mythic()) {
     *     // Wow! Trúng Mythic!
     * }
     * ```
     */
    public fun roll_rarity(clock: &Clock, ctx: &mut TxContext): u8 {
        let roll = random_in_range(0, 999, clock, ctx);  // 0-999 = 1000 khả năng
        
        // So sánh từ cao xuống thấp
        if (roll >= RARITY_THRESHOLD_MYTHIC) {           // 999
            RARITY_MYTHIC
        } else if (roll >= RARITY_THRESHOLD_LEGENDARY) { // 990-998
            RARITY_LEGENDARY
        } else if (roll >= RARITY_THRESHOLD_EPIC) {      // 970-989
            RARITY_EPIC
        } else if (roll >= RARITY_THRESHOLD_RARE) {      // 900-969
            RARITY_RARE
        } else if (roll >= RARITY_THRESHOLD_UNCOMMON) {  // 700-899
            RARITY_UNCOMMON
        } else {                                         // 0-699
            RARITY_COMMON
        }
    }

    /// Roll stat trong khoảng phù hợp với rarity
    public fun roll_stat_for_rarity(rarity: u8, is_hp: bool, clock: &Clock, ctx: &mut TxContext): u64 {
        let (min, max) = if (is_hp) {
            get_hp_range_for_rarity(rarity)
        } else {
            get_stamina_range_for_rarity(rarity)
        };
        
        random_in_range(min, max, clock, ctx)
    }

    /// Lấy khoảng HP cho rarity
    public fun get_hp_range_for_rarity(rarity: u8): (u64, u64) {
        if (rarity == RARITY_COMMON) {
            (COMMON_HP_MIN, COMMON_HP_MAX)
        } else if (rarity == RARITY_UNCOMMON) {
            (UNCOMMON_HP_MIN, UNCOMMON_HP_MAX)
        } else if (rarity == RARITY_RARE) {
            (RARE_HP_MIN, RARE_HP_MAX)
        } else if (rarity == RARITY_EPIC) {
            (EPIC_HP_MIN, EPIC_HP_MAX)
        } else if (rarity == RARITY_LEGENDARY) {
            (LEGENDARY_HP_MIN, LEGENDARY_HP_MAX)
        } else if (rarity == RARITY_MYTHIC) {
            (MYTHIC_HP_MIN, MYTHIC_HP_MAX)
        } else {
            abort E_INVALID_RARITY
        }
    }

    /// Lấy khoảng Stamina cho rarity
    public fun get_stamina_range_for_rarity(rarity: u8): (u64, u64) {
        if (rarity == RARITY_COMMON) {
            (COMMON_STAMINA_MIN, COMMON_STAMINA_MAX)
        } else if (rarity == RARITY_UNCOMMON) {
            (UNCOMMON_STAMINA_MIN, UNCOMMON_STAMINA_MAX)
        } else if (rarity == RARITY_RARE) {
            (RARE_STAMINA_MIN, RARE_STAMINA_MAX)
        } else if (rarity == RARITY_EPIC) {
            (EPIC_STAMINA_MIN, EPIC_STAMINA_MAX)
        } else if (rarity == RARITY_LEGENDARY) {
            (LEGENDARY_STAMINA_MIN, LEGENDARY_STAMINA_MAX)
        } else if (rarity == RARITY_MYTHIC) {
            (MYTHIC_STAMINA_MIN, MYTHIC_STAMINA_MAX)
        } else {
            abort E_INVALID_RARITY
        }
    }

    /// Roll nghề nghiệp ngẫu nhiên
    public fun roll_profession(clock: &Clock, ctx: &mut TxContext): u8 {
        let roll = random_in_range(0, 4, clock, ctx);
        (roll as u8)
    }

    /// Lấy số lượng skill slots dựa trên rarity
    public fun get_skill_slots_for_rarity(rarity: u8): u64 {
        if (rarity == RARITY_COMMON) {
            1
        } else if (rarity == RARITY_UNCOMMON) {
            1
        } else if (rarity == RARITY_RARE) {
            2
        } else if (rarity == RARITY_EPIC) {
            3
        } else if (rarity == RARITY_LEGENDARY || rarity == RARITY_MYTHIC) {
            4
        } else {
            abort E_INVALID_RARITY
        }
    }

    // ==================== EVENT EMISSION HELPERS ====================
    
    public fun emit_recruit_event(
        npc_id: address,
        owner: address,
        rarity: u8,
        profession: u8,
        max_hp: u64,
        stamina: u64,
        clock: &Clock,
    ) {
        event::emit(RecruitEvent {
            npc_id,
            owner,
            rarity,
            profession,
            max_hp,
            stamina,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    public fun emit_expedition_start_event(
        npc_id: address,
        owner: address,
        duration: u64,
        clock: &Clock,
    ) {
        event::emit(ExpeditionStartEvent {
            npc_id,
            owner,
            duration,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    public fun emit_expedition_result_event(
        npc_id: address,
        owner: address,
        success: bool,
        resources_gained: u64,
        items_gained: u64,
        damage_taken: u64,
        clock: &Clock,
    ) {
        event::emit(ExpeditionResultEvent {
            npc_id,
            owner,
            success,
            resources_gained,
            items_gained,
            damage_taken,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    public fun emit_level_up_event(
        npc_id: address,
        owner: address,
        new_level: u64,
        new_max_hp: u64,
        new_stamina: u64,
        clock: &Clock,
    ) {
        event::emit(LevelUpEvent {
            npc_id,
            owner,
            new_level,
            new_max_hp,
            new_stamina,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    public fun emit_death_event(
        npc_id: address,
        owner: address,
        rarity: u8,
        level: u64,
        cause: vector<u8>,
        clock: &Clock,
    ) {
        event::emit(DeathEvent {
            npc_id,
            owner,
            rarity,
            level,
            cause,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    public fun emit_equip_event(
        npc_id: address,
        item_id: address,
        equipped: bool,
        clock: &Clock,
    ) {
        event::emit(EquipEvent {
            npc_id,
            item_id,
            equipped,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    public fun emit_bunker_upgrade_event(
        bunker_id: address,
        owner: address,
        new_level: u64,
        new_capacity: u64,
        clock: &Clock,
    ) {
        event::emit(BunkerUpgradeEvent {
            bunker_id,
            owner,
            new_level,
            new_capacity,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    // ==================== GETTERS ====================
    
    public fun rarity_common(): u8 { RARITY_COMMON }
    public fun rarity_uncommon(): u8 { RARITY_UNCOMMON }
    public fun rarity_rare(): u8 { RARITY_RARE }
    public fun rarity_epic(): u8 { RARITY_EPIC }
    public fun rarity_legendary(): u8 { RARITY_LEGENDARY }
    public fun rarity_mythic(): u8 { RARITY_MYTHIC }
    
    public fun profession_scavenger(): u8 { PROFESSION_SCAVENGER }
    public fun profession_engineer(): u8 { PROFESSION_ENGINEER }
    public fun profession_medic(): u8 { PROFESSION_MEDIC }
    public fun profession_guard(): u8 { PROFESSION_GUARD }
    public fun profession_trader(): u8 { PROFESSION_TRADER }
    
    public fun item_type_weapon(): u8 { ITEM_TYPE_WEAPON }
    public fun item_type_armor(): u8 { ITEM_TYPE_ARMOR }
    public fun item_type_tool(): u8 { ITEM_TYPE_TOOL }
    public fun item_type_medicine(): u8 { ITEM_TYPE_MEDICINE }
    
    public fun recruit_cost(): u64 { RECRUIT_COST_MIST }
    public fun base_expedition_duration(): u64 { BASE_EXPEDITION_DURATION }

    // ==================== TESTS ====================
    
    #[test_only]
    public fun test_roll_rarity(clock: &Clock, ctx: &mut TxContext): u8 {
        roll_rarity(clock, ctx)
    }
    
    #[test_only]
    public fun test_random_in_range(min: u64, max: u64, clock: &Clock, ctx: &mut TxContext): u64 {
        random_in_range(min, max, clock, ctx)
    }
}
