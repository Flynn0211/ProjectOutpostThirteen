// Module: expedition
// Mô tả: Hệ thống thám hiểm với TRUE RISK & REWARD
// NPCs có thể thành công (level up, rewards) hoặc BỊ KNOCKED OUT

#[allow(unused_const, unused_variable)]
module contracts::expedition {
    use sui::clock::Clock;
    use sui::tx_context::TxContext;
    
    use contracts::utils;
    use contracts::npc::{Self, NPC};
    use contracts::bunker::{Self, Bunker};


    // ==================== ERROR CODES ====================
    const E_NPC_NOT_READY: u64 = 400;

    const E_INVALID_DURATION: u64 = 402;

    // ==================== CONSTANTS ====================
    
    // Các thresholds cho kết quả expedition
    const CRITICAL_SUCCESS_THRESHOLD: u64 = 95;   // 95-100 = Critical Success (5%)
    const SUCCESS_THRESHOLD: u64 = 45;            // 45-94 = Success (50%)
    const PARTIAL_SUCCESS_THRESHOLD: u64 = 25;    // 25-44 = Partial Success (20%)
    const FAILURE_THRESHOLD: u64 = 5;             // 5-24 = Failure (20%)
    // 0-4 = Critical Failure (5%) -> NPC KNOCKED OUT

    // Rewards và risks
    const CRITICAL_SUCCESS_RESOURCES: u64 = 200;
    const SUCCESS_RESOURCES: u64 = 100;
    const PARTIAL_SUCCESS_RESOURCES: u64 = 50;
    
    const CRITICAL_SUCCESS_DAMAGE: u64 = 0;
    const SUCCESS_DAMAGE: u64 = 10;
    const PARTIAL_SUCCESS_DAMAGE: u64 = 25;
    const FAILURE_DAMAGE: u64 = 50;
    
    // Profession bonuses
    const SCAVENGER_SUCCESS_BONUS: u64 = 10;      // +10% success cho Scavenger
    const MEDIC_DAMAGE_REDUCTION: u64 = 5;        // -5 damage cho Medic
    const GUARD_CRITICAL_SUCCESS_BONUS: u64 = 5;  // +5% critical success cho Guard

    // ==================== CORE EXPEDITION LOGIC ====================
    
    /// Bắt đầu expedition
    /// Duration tính bằng giờ (1 = 1 giờ, 2 = 2 giờ, etc.)
    public entry fun start_expedition(
        npc: &mut NPC,
        bunker: &mut Bunker,
        duration: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // CRITICAL: Kiểm tra ownership - NPC và Bunker phải cùng owner và là sender
        assert!(npc::get_owner(npc) == sender, E_NPC_NOT_READY);
        assert!(bunker::get_owner(bunker) == sender, E_NPC_NOT_READY);
        
        // Kiểm tra NPC sẵn sàng
        assert!(npc::is_ready_for_expedition(npc), E_NPC_NOT_READY);
        assert!(duration > 0 && duration <= 24, E_INVALID_DURATION); // Max 24 hours
        
        // ✅ Phase 1: Check hunger/thirst sufficient
        let hunger = npc::get_hunger(npc);
        let thirst = npc::get_thirst(npc);
        assert!(hunger >= 20, E_NPC_NOT_READY); // Need at least 20 hunger
        assert!(thirst >= 20, E_NPC_NOT_READY); // Need at least 20 thirst
        
        // Emit start event
        utils::emit_expedition_start_event(
            npc::get_id(npc),
            sender,
            duration * utils::base_expedition_duration(),
            clock
        );
        
        // ✅ Phase 1: Consume hunger/thirst
        npc::consume_hunger(npc, 20);
        npc::consume_thirst(npc, 15);
        
        // Giảm stamina
        let stamina_cost = 20 + (duration * 5);
        npc::consume_stamina(npc, stamina_cost);
        
        // Tính toán kết quả expedition
        let (success_rate, item_chance) = calculate_success_rate(npc, duration);
        
        // Roll kết quả
        let roll = utils::random_in_range(0, 100, clock, ctx);
        
        // Xử lý kết quả dựa trên roll
        // UPDATE: Removed Mission Failed.
        // 0-44: Partial Success (45%)
        // 45-94: Success (50%)
        // 95-100: Critical Success (5%)
        
        if (roll < SUCCESS_THRESHOLD) { // < 45
            // Partial Success (Merging Failure/Critical Failure into this)
            handle_partial_success(npc, bunker, duration, clock, ctx);
        } else if (roll < CRITICAL_SUCCESS_THRESHOLD) { // < 95
            // Success
            handle_success(npc, bunker, duration, item_chance, clock, ctx);
        } else {
            // Critical Success
            handle_critical_success(npc, bunker, duration, item_chance, clock, ctx);
        };
    }

    // ==================== OUTCOME HANDLERS ====================
    
    /// Critical Success - Reward tối đa, level up, không damage
    fun handle_critical_success(
        npc: &mut NPC,
        bunker: &mut Bunker,
        duration: u64,
        item_chance: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Rewards
        let resources = CRITICAL_SUCCESS_RESOURCES + (duration * 50);
        bunker::add_resources(bunker, resources);
        
        // Level up
        npc::level_up(npc, clock);
        
        // ✅ Phase 3: Reduce durability (outcome 0 = critical success)
        npc::reduce_equipped_durability(npc, 0);
        
        // ✅ Phase 3: Blueprint drop (15% chance on critical success)
        let blueprint_roll = utils::random_in_range(0, 100, clock, ctx);
        if (blueprint_roll < 15) {
            let bp_rarity = utils::roll_rarity(clock, ctx);
            let bp_type = (utils::random_in_range(1, 4, clock, ctx) as u8); // 1-3: Weapon/Armor/Tool
            
            let blueprint = contracts::crafting::create_blueprint(bp_type, bp_rarity, ctx);
            let bp_id = object::id(&blueprint);
            let sender = npc::get_owner(npc);
            transfer::public_transfer(blueprint, sender);
            
            utils::emit_blueprint_dropped_event(bp_id, sender, bp_type, bp_rarity, clock);
        };
        
        // Deterministic Drops: Critical Success = 1 item per hour (Max loot)
        let num_items = duration;
        
        let mut i = 0;
        let mut items_gained = 0;
        let mut i = 0;
        let mut items_gained = 0;
        while (i < num_items) {
             // Dùng create_loot_item với seed là i để tránh trùng lặp
             contracts::item::create_loot_item(i, clock, ctx);
             items_gained = items_gained + 1;
             i = i + 1;
        };
        
        // Emit result event
        let food = resources / 2;
        let water = resources / 4;
        let scrap = resources / 4;
        
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            true,
            food,
            water,
            scrap,
            items_gained,
            CRITICAL_SUCCESS_DAMAGE,
            clock
        );
    }

    /// Success - Reward tốt, level up nhỏ, damage nhẹ
    fun handle_success(
        npc: &mut NPC,
        bunker: &mut Bunker,
        duration: u64,
        item_chance: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Rewards
        let resources = SUCCESS_RESOURCES + (duration * 30);
        bunker::add_resources(bunker, resources);
        
        // Level up
        npc::level_up(npc, clock);
        
        // Damage
        let damage = calculate_damage(npc, SUCCESS_DAMAGE);
        npc::take_damage(npc, damage);
        
        // ✅ Phase 3: Reduce durability (outcome 1 = success)
        npc::reduce_equipped_durability(npc, 1);
        
        // ✅ Phase 3: Blueprint drop (8% chance on success)
        let blueprint_roll = utils::random_in_range(0, 100, clock, ctx);
        if (blueprint_roll < 8) {
            let bp_rarity = utils::roll_rarity(clock, ctx);
            let bp_type = (utils::random_in_range(1, 4, clock, ctx) as u8);
            
            let blueprint = contracts::crafting::create_blueprint(bp_type, bp_rarity, ctx);
            let bp_id = object::id(&blueprint);
            let sender = npc::get_owner(npc);
            transfer::public_transfer(blueprint, sender);
            
            utils::emit_blueprint_dropped_event(bp_id, sender, bp_type, bp_rarity, clock);
        };
        
        // Deterministic Drops: Regular Success = 1 item per 2 hours (approx)
        // Formula: (duration + 1) / 2 -> 1h=1, 12h=6, 24h=12
        let num_items = (duration + 1) / 2;
        
        let mut i = 0;
        let mut items_gained = 0;
        let mut i = 0;
        let mut items_gained = 0;
        while (i < num_items) {
             // Dùng create_loot_item với seed là i để tránh trùng lặp
             contracts::item::create_loot_item(i, clock, ctx);
             items_gained = items_gained + 1;
             i = i + 1;
        };
        
        // Emit result event
        let food = resources / 2;
        let water = resources / 4;
        let scrap = resources / 4;
        
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            true,
            food,
            water,
            scrap,
            items_gained,
            damage,
            clock
        );
    }

    /// Partial Success - Reward thấp, damage vừa
    fun handle_partial_success(
        npc: &mut NPC,
        bunker: &mut Bunker,
        duration: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Rewards ít
        let resources = PARTIAL_SUCCESS_RESOURCES + (duration * 10);
        bunker::add_resources(bunker, resources);
        
        // Damage vừa
        let damage = calculate_damage(npc, PARTIAL_SUCCESS_DAMAGE);
        npc::take_damage(npc, damage);
        
        // ✅ Phase 3: Reduce durability (outcome 2 = partial success)
        npc::reduce_equipped_durability(npc, 2);
        
        // ✅ Phase 3: Blueprint drop (3% chance on partial success)
        let blueprint_roll = utils::random_in_range(0, 100, clock, ctx);
        if (blueprint_roll < 3) {
            let bp_rarity = utils::roll_rarity(clock, ctx);
            let bp_type = (utils::random_in_range(1, 4, clock, ctx) as u8);
            
            let blueprint = contracts::crafting::create_blueprint(bp_type, bp_rarity, ctx);
            let bp_id = object::id(&blueprint);
            let sender = npc::get_owner(npc);
            transfer::public_transfer(blueprint, sender);
            
            utils::emit_blueprint_dropped_event(bp_id, sender, bp_type, bp_rarity, clock);
        };

        
        // Update: Partial Success cũng nhận được chút ít item (khuyến khích)
        // Formula: Duration / 3 (e.g., 24h -> 8 items, 1h -> 0 items)
        let num_items = duration / 3;
        
        let mut i = 0;
        let mut items_gained = 0;
        while (i < num_items) {
             contracts::item::create_loot_item(i + 100, clock, ctx); // Salt offset 100
             items_gained = items_gained + 1;
             i = i + 1;
        };
        
        // Emit result event
        let food = resources / 2;
        let water = resources / 4;
        let scrap = resources / 4;
        
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            false,
            food,
            water,
            scrap,
            items_gained,
            damage,
            clock
        );
    }

    /// Failure - Không reward, damage nặng
    fun handle_failure(
        npc: &mut NPC,
        bunker: &mut Bunker,
        clock: &Clock,
    ) {
        // Không có resources
        
        // Damage nặng
        let damage = calculate_damage(npc, FAILURE_DAMAGE);
        npc::take_damage(npc, damage);
        
        // ✅ Phase 3: Reduce durability (outcome 3 = failure)
        npc::reduce_equipped_durability(npc, 3);
        
        // Emit result event
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            false,
            0,
            0,
            0,
            0,
            damage,
            clock
        );
    }

    /// Critical Failure - NPC BỊ KNOCKED OUT (BẤT TỈNH)
    /// NPC sẽ có HP = 0 và cần Revival Potion hoặc chờ recovery time
    fun handle_critical_failure(
        npc: &mut NPC,
        bunker: &mut Bunker,
        clock: &Clock,
    ) {
        // Không còn destroy NPC, mà đánh ngất (Knock Out)
        // NPC sẽ có HP = 0 và có thể recovery bằng: Revival Potion, tự hồi sau 1h, hoặc instant recovery
        
        npc::knock_out(npc, b"expedition_critical_failure", clock);
        
        // ✅ Phase 3: Reduce durability (outcome 4 = critical failure)
        npc::reduce_equipped_durability(npc, 4);
        
        // Emit expedition result
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            false,
            0,
            0,
            0,
            0,
            9999, // Max damage indicator for knockout
            clock
        );
    }
        


    // ==================== CALCULATION HELPERS ====================
    
    /// Tính success rate dựa trên stats NPC, profession, equipped items, duration
    fun calculate_success_rate(npc: &NPC, duration: u64): (u64, u64) {
        // ... (Base success rate logic unchanged)
        let combat_power = npc::get_combat_power(npc);
        let mut success_rate = 80; // Base success rate increased to 80% as requested
        
        success_rate = success_rate + (combat_power / 100) * 5;
        
        if (duration > 1) {
            let penalty = (duration - 1) * 1; // Reduced penalty: only -1% per hour
            if (success_rate > penalty) {
                success_rate = success_rate - penalty;
            } else {
                success_rate = 30; // Min success rate increased to 30%
            };
        };
        
        let profession = npc::get_profession(npc);
        if (profession == utils::profession_scavenger()) {
            success_rate = success_rate + SCAVENGER_SUCCESS_BONUS;
        } else if (profession == utils::profession_guard()) {
            success_rate = success_rate + GUARD_CRITICAL_SUCCESS_BONUS;
        } else if (profession == utils::profession_medic()) {
            success_rate = success_rate + 5;
        };
        
        let (_, bonus_atk, _, _) = npc::get_equipped_bonus(npc);
        let weapon_bonus = bonus_atk / 5; 
        success_rate = success_rate + weapon_bonus;
        
        if (success_rate > 95) { // Cap increased to 95%
            success_rate = 95; 
        };
        
        // Item Chance không còn được dùng để tính xác suất drop nữa (vì drop là deterministic)
        // Tuy nhiên vẫn giữ function signature cũ để tránh breaking changes
        let item_chance = 0; 
        
        (success_rate, item_chance)
    }

    /// Tính damage với reduction từ Medic và ARMOR BONUS
    fun calculate_damage(npc: &NPC, base_damage: u64): u64 {
        let mut damage = base_damage;
        
        // Reduction từ Medic profession
        if (npc::get_profession(npc) == utils::profession_medic()) {
            if (damage > MEDIC_DAMAGE_REDUCTION) {
                damage = damage - MEDIC_DAMAGE_REDUCTION;
            } else {
                damage = 0;
            };
        };
        
        // ARMOR REDUCTION: Defense + HP bonuses giảm damage
        // Đây là phần quan trọng nhất để armor có ý nghĩa
        let (bonus_hp, _, bonus_def, _) = npc::get_equipped_bonus(npc);
        let armor_reduction = (bonus_hp + bonus_def) / 5; // Mỗi 5 def/hp = -1 damage
        
        if (damage > armor_reduction) {
            damage = damage - armor_reduction;
        } else {
            damage = 0; // Armor hoàn toàn chặn damage
        };
        
        damage
    }

    // ==================== CONVENIENCE FUNCTIONS ====================
    
    /// Quick expedition - duration 1 giờ
    public entry fun quick_expedition(
        npc: &mut NPC,
        bunker: &mut Bunker,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        start_expedition(npc, bunker, 1, clock, ctx);
    }

    /// Long expedition - duration 4 giờ, rủi ro cao hơn nhưng reward lớn hơn
    public entry fun long_expedition(
        npc: &mut NPC,
        bunker: &mut Bunker,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        start_expedition(npc, bunker, 4, clock, ctx);
    }

    // ==================== GETTERS ====================
    
    /// Tính success rate preview (không thực hiện expedition)
    public fun preview_expedition_success(npc: &NPC, duration: u64): (u64, u64) {
        calculate_success_rate(npc, duration)
    }
}
