// Module: expedition
// Mô tả: Hệ thống thám hiểm với TRUE RISK & REWARD
// NPCs có thể thành công (level up, rewards) hoặc CHẾT VĨNH VIỄN

#[allow(unused_const, unused_variable)]
module contracts::expedition {
    use sui::clock::Clock;
    use sui::tx_context::TxContext;
    
    use contracts::utils;
    use contracts::npc::{Self, NPC};
    use contracts::bunker::{Self, Bunker};


    // ==================== ERROR CODES ====================
    const E_NPC_NOT_READY: u64 = 400;
    const E_INSUFFICIENT_STATS: u64 = 401;
    const E_INVALID_DURATION: u64 = 402;

    // ==================== CONSTANTS ====================
    
    // Các thresholds cho kết quả expedition
    const CRITICAL_SUCCESS_THRESHOLD: u64 = 95;   // 95-100 = Critical Success (5%)
    const SUCCESS_THRESHOLD: u64 = 45;            // 45-94 = Success (50%)
    const PARTIAL_SUCCESS_THRESHOLD: u64 = 25;    // 25-44 = Partial Success (20%)
    const FAILURE_THRESHOLD: u64 = 5;             // 5-24 = Failure (20%)
    // 0-4 = Critical Failure (5%) -> PERMANENT DEATH

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
        // Kiểm tra NPC sẵn sàng
        assert!(npc::is_ready_for_expedition(npc), E_NPC_NOT_READY);
        assert!(duration > 0 && duration <= 24, E_INVALID_DURATION); // Max 24 hours
        
        let sender = tx_context::sender(ctx);
        
        // Emit start event
        utils::emit_expedition_start_event(
            npc::get_id(npc),
            sender,
            duration * utils::base_expedition_duration(),
            clock
        );
        
        // Giảm stamina và needs trước khi đi
        let stamina_cost = 20 + (duration * 5);
        npc::consume_stamina(npc, stamina_cost);
        npc::decrease_needs(npc, duration * 10, duration * 15);
        
        // Tính toán kết quả expedition
        let (success_rate, item_chance) = calculate_success_rate(npc, duration);
        
        // Roll kết quả
        let roll = utils::random_in_range(0, 100, clock, ctx);
        
        // Xử lý kết quả dựa trên roll
        if (roll < 5) {
            // CRITICAL FAILURE - PERMANENT DEATH
            handle_critical_failure(npc, bunker, clock);
        } else if (roll < FAILURE_THRESHOLD + 20) {
            // Failure
            handle_failure(npc, bunker, clock);
        } else if (roll < PARTIAL_SUCCESS_THRESHOLD + 20) {
            // Partial Success
            handle_partial_success(npc, bunker, duration, clock, ctx);
        } else if (roll < SUCCESS_THRESHOLD + 50) {
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
        
        // Có cơ hội cao nhận item
        let item_roll = utils::random_in_range(0, 100, clock, ctx);
        let items_gained = if (item_roll < item_chance + 30) { 1 } else { 0 };
        
        if (items_gained > 0) {
            // Tạo item và gửi cho owner (simplified - trong thực tế sẽ call item::create_item)
            // Để đơn giản, chỉ track số lượng trong event
        };
        
        // Emit result event
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            true,
            resources,
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
        
        // Có cơ hội nhận item
        let item_roll = utils::random_in_range(0, 100, clock, ctx);
        let items_gained = if (item_roll < item_chance) { 1 } else { 0 };
        
        // Emit result event
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            true,
            resources,
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
        
        // Emit result event
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            false,
            resources,
            0,
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
        
        // Emit result event
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            false,
            0,
            0,
            damage,
            clock
        );
    }

    /// Critical Failure - PERMANENT DEATH - NPC BỊ HỦY VĨNH VIỄN
    fun handle_critical_failure(
        npc: &mut NPC,
        bunker: &mut Bunker,
        clock: &Clock,
    ) {
        // Không còn destroy NPC, mà đánh ngất (Knock Out)
        // NPC sẽ có HP = 0 và cần Revival Potion để hồi sinh
        
        npc::knock_out(npc, b"expedition_critical_failure", clock);
        
        // Emit expedition result
        utils::emit_expedition_result_event(
            npc::get_id(npc),
            npc::get_owner(npc),
            false,
            0,
            0,
            9999, // Max damage indicator for knockout
            clock
        );
    }
        


    // ==================== CALCULATION HELPERS ====================
    
    /// Tính success rate dựa trên stats NPC, profession, equipped items, duration
    fun calculate_success_rate(npc: &NPC, duration: u64): (u64, u64) {
        // Base success rate từ combat power
        let combat_power = npc::get_combat_power(npc);
        let mut success_rate = 50; // Base 50%
        
        // Bonus từ combat power (mỗi 100 power = +5%)
        success_rate = success_rate + (combat_power / 100) * 5;
        
        // Penalty từ duration dài (mỗi giờ thêm = -2%)
        if (duration > 1) {
            let penalty = (duration - 1) * 2;
            if (success_rate > penalty) {
                success_rate = success_rate - penalty;
            } else {
                success_rate = 20; // Minimum 20%
            };
        };
        
        // Bonus từ profession
        let profession = npc::get_profession(npc);
        if (profession == utils::profession_scavenger()) {
            success_rate = success_rate + SCAVENGER_SUCCESS_BONUS;
        } else if (profession == utils::profession_guard()) {
            success_rate = success_rate + GUARD_CRITICAL_SUCCESS_BONUS;
        } else if (profession == utils::profession_medic()) {
            success_rate = success_rate + 5;
        };
        
        // Bonus từ equipped item
        let (bonus_hp, bonus_atk, bonus_def, bonus_luck) = npc::get_equipped_bonus(npc);
        let equipment_bonus = (bonus_hp + bonus_atk + bonus_def + bonus_luck) / 10;
        success_rate = success_rate + equipment_bonus;
        
        // Cap success rate
        if (success_rate > 90) {
            success_rate = 90; // Max 90%
        };
        
        // Item chance (base 30%)
        let mut item_chance = 30 + (npc::get_level(npc) * 2);
        if (item_chance > 70) {
            item_chance = 70;
        };
        
        (success_rate, item_chance)
    }

    /// Tính damage, có reduction từ Medic và equipped armor
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
        
        // Reduction từ equipped armor
        let (bonus_hp, _, bonus_def, _) = npc::get_equipped_bonus(npc);
        let armor_reduction = (bonus_hp + bonus_def) / 5;
        if (damage > armor_reduction) {
            damage = damage - armor_reduction;
        } else {
            damage = 0;
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
