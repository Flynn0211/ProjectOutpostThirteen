// Module: raid
// Mô tả: Phase 4 - Hệ thống PvP Tấn công Bunker
// Cho phép người chơi tấn công bunker của người khác để cướp tài nguyên

module contracts::raid {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use sui::event;
    
    use contracts::bunker::{Self, Bunker};
    use contracts::utils;

    // ==================== MÃ LỖI ====================
    
    const E_NOT_OWNER: u64 = 1300;              // Không phải chủ sở hữu
    const E_RAID_COOLDOWN: u64 = 1301;          // Chưa hết cooldown 24h
    const E_MAX_RAIDS_REACHED: u64 = 1302;      // Đã đạt giới hạn 3 lần/ngày
    const E_INSUFFICIENT_SCRAP: u64 = 1303;     // Không đủ phế liệu
    const E_INSUFFICIENT_PAYMENT: u64 = 1304;   // Không đủ SUI
    const E_NO_NPCS: u64 = 1305;                // Không có NPC tham gia
    const E_CANNOT_RAID_SELF: u64 = 1306;       // Không thể tấn công chính mình

    // ==================== HẰNG SỐ ====================
    
    // Chi phí tấn công
    const RAID_COST_SCRAP: u64 = 50;            // 50 Scrap
    const RAID_COST_SUI: u64 = 100_000_000;     // 0.1 SUI (burned)

    // Giới hạn thời gian
    const RAID_COOLDOWN_MS: u64 = 86400000;     // 24 giờ cooldown/bunker
    const MAX_RAIDS_PER_DAY: u64 = 3;           // Tối đa 3 lần/ngày
    const DAY_MS: u64 = 86400000;               // 1 ngày = 24h

    // Phần thưởng và cướp bóc
    const LOOT_PERCENT_ON_WIN: u64 = 20;        // Kẻ tấn công cướp 20% tài nguyên
    const HOME_ADVANTAGE_PERCENT: u64 = 10;     // Người phòng thủ +10% sức mạnh
    const DEFENSE_WIN_SCRAP: u64 = 10;          // Thưởng khi phòng thủ thành công

    // ==================== STRUCTS ====================
    
    /// Lịch sử tấn công toàn cầu (shared object)
    public struct RaidHistory has key {
        id: UID,
        last_raid_times: Table<address, u64>,         // Bunker → thời điểm raid cuối
        daily_raid_counts: Table<address, RaidCount>,  // Attacker → số lần raid hôm nay
    }
    
    /// Theo dõi số lần raid mỗi ngày
    public struct RaidCount has store {
        count: u64,       // Số lần đã raid hôm nay
        reset_at: u64,    // Thời điểm reset (ngày mới)
    }
    
    /// Sự kiện kết quả tấn công
    public struct RaidResult has copy, drop {
        attacker: address,
        defender: address,
        attacker_npc_count: u64,
        success: bool,
        attacker_power: u64,
        defender_power: u64,
        food_looted: u64,
        water_looted: u64,
        scrap_looted: u64,
        timestamp: u64,
    }

    // ==================== INIT ====================
    
    /// Initialize raid history (called once on deployment)
    fun init(ctx: &mut TxContext) {
        let history = RaidHistory {
            id: object::new(ctx),
            last_raid_times: table::new(ctx),
            daily_raid_counts: table::new(ctx),
        };
        transfer::share_object(history);
    }

    // ==================== MAIN FUNCTIONS ====================
    
    
    /// Start a raid on another bunker
    /// MVP version: Uses NPC count instead of actual NPC objects
    public entry fun start_raid(
        attacker_bunker: &mut Bunker,
        attacker_npc_count: u64,  // Number of NPCs participating (simplified for MVP)
        defender_bunker_id: address,
        defender_owner: address,
        defender_bunker_level: u64,
        defender_npc_count: u64,
        defender_food: u64,
        defender_water: u64,
        defender_scrap: u64,
        mut payment: Coin<SUI>,
        raid_history: &mut RaidHistory,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let attacker = tx_context::sender(ctx);
        let defender = defender_owner;
        let current_time = clock::timestamp_ms(clock);
        
        // ===== VALIDATION =====
        
        // 1. Check ownership
        assert!(bunker::get_owner(attacker_bunker) == attacker, E_NOT_OWNER);
        
        // 2. Cannot raid self (either by owner or by same bunker id)
        assert!(attacker != defender, E_CANNOT_RAID_SELF);
        assert!(bunker::get_address(attacker_bunker) != defender_bunker_id, E_CANNOT_RAID_SELF);
        
        // 3. Check has NPCs
        assert!(attacker_npc_count > 0, E_NO_NPCS);
        
        // 4. Check cooldown (24h per defender bunker)
        if (table::contains(&raid_history.last_raid_times, defender_bunker_id)) {
            let last_raid = *table::borrow(&raid_history.last_raid_times, defender_bunker_id);
            assert!(current_time - last_raid >= RAID_COOLDOWN_MS, E_RAID_COOLDOWN);
        };
        
        // 5. Check daily raid limit (3 raids/day per attacker)
        check_daily_limit(raid_history, attacker, current_time);
        
        // 6. Check resources
        assert!(bunker::get_scrap(attacker_bunker) >= RAID_COST_SCRAP, E_INSUFFICIENT_SCRAP);
        assert!(coin::value(&payment) >= RAID_COST_SUI, E_INSUFFICIENT_PAYMENT);
        
        // ===== CONSUME COSTS =====
        
        bunker::consume_scrap(attacker_bunker, RAID_COST_SCRAP);
        let sui_coin = coin::split(&mut payment, RAID_COST_SUI, ctx);
        transfer::public_transfer(sui_coin, @0x0);  // Burn SUI
        
        // ===== CALCULATE COMBAT =====
        
        // MVP: Use simplified power calculation
        // Each NPC contributes 100 power
        let mut attacker_power = attacker_npc_count * 100;
        
        // Defender power comes primarily from defending NPCs (NPCs assigned to rooms).
        // Also add a modest bunker-level baseline to preserve progression.
        let mut defender_power = defender_npc_count * 100;
        defender_power = defender_power + (defender_bunker_level * 50);
        
        // Home advantage: +10%
        defender_power = defender_power + (defender_power * HOME_ADVANTAGE_PERCENT / 100);
        
        // Add randomness (±10%)
        let random_factor = utils::random_in_range(90, 111, clock, ctx);
        attacker_power = (attacker_power * random_factor) / 100;
        
        // ===== DETERMINE OUTCOME =====
        
        let success = attacker_power > defender_power;
        let mut food_looted = 0;
        let mut water_looted = 0;
        let mut scrap_looted = 0;
        
        if (success) {
            // Attacker wins - loot 20% of defender snapshot resources.
            // NOTE: In this MVP, we do not mutate the defender's owned bunker on-chain.
            food_looted = (defender_food * LOOT_PERCENT_ON_WIN) / 100;
            water_looted = (defender_water * LOOT_PERCENT_ON_WIN) / 100;
            scrap_looted = (defender_scrap * LOOT_PERCENT_ON_WIN) / 100;

            // Credit resources to attacker
            bunker::add_food(attacker_bunker, food_looted);
            bunker::add_water(attacker_bunker, water_looted);
            bunker::add_scrap(attacker_bunker, scrap_looted);
        };
        
        // ===== UPDATE HISTORY =====
        
        // Update last raid time for this defender bunker id
        if (table::contains(&raid_history.last_raid_times, defender_bunker_id)) {
            *table::borrow_mut(&mut raid_history.last_raid_times, defender_bunker_id) = current_time;
        } else {
            table::add(&mut raid_history.last_raid_times, defender_bunker_id, current_time);
        };
        
        // Update daily count
        increment_daily_count(raid_history, attacker, current_time);
        
        // ===== EMIT EVENT =====
        
        event::emit(RaidResult {
            attacker,
            defender,
            attacker_npc_count,
            success,
            attacker_power,
            defender_power,
            food_looted,
            water_looted,
            scrap_looted,
            timestamp: current_time,
        });
        
        // Return excess payment
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, attacker);
        } else {
            coin::destroy_zero(payment);
        };
    }


    // ==================== HELPER FUNCTIONS ====================
    
    /// Check if player has reached daily raid limit
    fun check_daily_limit(
        raid_history: &RaidHistory,
        attacker: address,
        current_time: u64
    ) {
        if (table::contains(&raid_history.daily_raid_counts, attacker)) {
            let count = table::borrow(&raid_history.daily_raid_counts, attacker);
            
            // Check if need to reset (new day)
            if (current_time >= count.reset_at) {
                // Will reset in increment function
                return
            };
            
            // Check limit
            assert!(count.count < MAX_RAIDS_PER_DAY, E_MAX_RAIDS_REACHED);
        };
    }

    /// Increment daily raid count
    fun increment_daily_count(
        raid_history: &mut RaidHistory,
        attacker: address,
        current_time: u64
    ) {
        if (table::contains(&raid_history.daily_raid_counts, attacker)) {
            let count = table::borrow_mut(&mut raid_history.daily_raid_counts, attacker);
            
            // Reset if new day
            if (current_time >= count.reset_at) {
                count.count = 1;
                count.reset_at = current_time + DAY_MS;
            } else {
                count.count = count.count + 1;
            };
        } else {
            table::add(&mut raid_history.daily_raid_counts, attacker, RaidCount {
                count: 1,
                reset_at: current_time + DAY_MS,
            });
        };
    }

    // ==================== VIEW FUNCTIONS ====================
    
    /// Get time until can raid specific bunker again
    public fun get_raid_cooldown_remaining(
        raid_history: &RaidHistory,
        defender_bunker_id: address,
        clock: &Clock
    ): u64 {
        if (!table::contains(&raid_history.last_raid_times, defender_bunker_id)) {
            return 0  // Can raid anytime
        };
        
        let last_raid = *table::borrow(&raid_history.last_raid_times, defender_bunker_id);
        let current_time = clock::timestamp_ms(clock);
        let elapsed = current_time - last_raid;
        
        if (elapsed >= RAID_COOLDOWN_MS) {
            0
        } else {
            RAID_COOLDOWN_MS - elapsed
        }
    }

    /// Get remaining raids today
    public fun get_remaining_raids_today(
        raid_history: &RaidHistory,
        attacker: address,
        clock: &Clock
    ): u64 {
        if (!table::contains(&raid_history.daily_raid_counts, attacker)) {
            return MAX_RAIDS_PER_DAY
        };
        
        let count = table::borrow(&raid_history.daily_raid_counts, attacker);
        let current_time = clock::timestamp_ms(clock);
        
        // Check if reset needed
        if (current_time >= count.reset_at) {
            return MAX_RAIDS_PER_DAY
        };
        
        if (count.count >= MAX_RAIDS_PER_DAY) {
            0
        } else {
            MAX_RAIDS_PER_DAY - count.count
        }
    }
}
