// Module: bunker
// Mô tả: Quản lý Bunker - căn cứ chính của người chơi
// Bunker chứa các phòng, tài nguyên, và có thể nâng cấp
// Version 2.0: Resource system refactor (Food, Water, Scrap, Power)

module contracts::bunker {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::clock::Clock;
    use sui::table::{Self as table, Table};
    use std::vector;
    use std::option::{Self as option, Option};
    use std::string::{Self, String};
    
    use contracts::utils;
    use contracts::item;

    // ==================== MÃ LỖI ====================
    const E_NOT_OWNER: u64 = 300;               // Không phải chủ sở hữu
    const E_ROOM_NOT_FOUND: u64 = 302;          // Không tìm thấy phòng
    const E_INVALID_ROOM_TYPE: u64 = 303;       // Loại phòng không hợp lệ
    const E_INSUFFICIENT_FOOD: u64 = 304;       // Không đủ thức ăn
    const E_INSUFFICIENT_WATER: u64 = 305;      // Không đủ nước
    const E_INSUFFICIENT_SCRAP: u64 = 306;      // Không đủ phế liệu
    const E_ROOM_FULL: u64 = 308;               // Phòng đã đầy
    const E_NPC_COUNT_UNDERFLOW: u64 = 309;     // NPC count underflow

    // Repair / crafting gating
    const E_ITEM_NOT_DAMAGED: u64 = 310;
    const E_WORKSHOP_REQUIRED: u64 = 311;
    const E_WORKSHOP_NO_POWER: u64 = 312;

    // ==================== HẰNG SỐ ====================
    
    // Tài nguyên ban đầu (Phase 1)
    const INITIAL_CAPACITY: u64 = 10;           // Sức chứa ban đầu: 10 NPCs
    const INITIAL_FOOD: u64 = 100;              // Thức ăn ban đầu
    const INITIAL_WATER: u64 = 100;             // Nước ban đầu
    const INITIAL_SCRAP: u64 = 50;              // Phế liệu ban đầu
    
    // Sức chứa phòng
    const LIVING_QUARTERS_CAPACITY: u64 = 10;   // Phòng ở: 10 NPCs
    const PRODUCTION_ROOM_CAPACITY: u64 = 3;    // Phòng sản xuất: 3 NPCs
    const CAPACITY_INCREASE_PER_LEVEL: u64 = 2; // Tăng 2/level
    
    // Điện năng (mỗi giờ)
    const POWER_GENERATOR_PRODUCE: u64 = 30;    // Máy phát: +30
    const POWER_GENERATOR_CONSUME: u64 = 5;     // Tiêu thụ: -5 (net +25)
    const POWER_FARM: u64 = 5;                  // Nông trại: -5
    const POWER_WATER_PUMP: u64 = 10;           // Bơm nước: -10
    const POWER_WORKSHOP: u64 = 15;             // Xưởng: -15
    const POWER_STORAGE: u64 = 3;               // Kho: -3
    
    // Tốc độ sản xuất (cơ bản, mỗi NPC, mỗi giờ)
    const FOOD_BASE_PRODUCTION: u64 = 10;       // Thức ăn: +10/NPC/h
    const WATER_BASE_PRODUCTION: u64 = 15;      // Nước: +15/NPC/h
    const SCRAP_BASE_PRODUCTION: u64 = 8;       // Phế liệu: +8/NPC/h (Workshop)
    
    // Costs
    const UPGRADE_COST_BASE: u64 = 100;
    const ROOM_UPGRADE_COST_BASE: u64 = 50;
    const ADD_ROOM_COST: u64 = 150;

    // Upgrade scaling & bonuses
    const ROOM_UPGRADE_CAPACITY_INCREASE: u64 = 3;
    const ROOM_UPGRADE_EFFICIENCY_INCREASE: u64 = 15;
    const ROOM_UPGRADE_PRODUCTION_RATE_INCREASE: u64 = 5;

    const BUNKER_UPGRADE_LIVING_CAPACITY_BONUS: u64 = 1;
    const BUNKER_UPGRADE_EFFICIENCY_BONUS: u64 = 5;
    const BUNKER_UPGRADE_PRODUCTION_RATE_BONUS: u64 = 2;

    // Power scaling (percent bonus per level above 1)
    const BUNKER_POWER_BONUS_PCT_PER_LEVEL: u64 = 10;
    const GENERATOR_POWER_BONUS_PCT_PER_LEVEL: u64 = 20;

    // Production tick (10 minutes)
    const PRODUCTION_TICK_MS: u64 = 600000;
    const PRODUCTION_TICKS_PER_HOUR: u64 = 6;

    // Storage utility (passive)
    const STORAGE_POWER_REDUCTION_PER_LEVEL: u64 = 2;

    // Extra farm byproduct
    const FARM_CLOTH_PER_FOOD: u64 = 500;
    
    // Room types
    const ROOM_TYPE_LIVING: u8 = 0;
    const ROOM_TYPE_GENERATOR: u8 = 1;
    const ROOM_TYPE_FARM: u8 = 2;
    const ROOM_TYPE_WATER_PUMP: u8 = 3;  
    const ROOM_TYPE_WORKSHOP: u8 = 4;
    const ROOM_TYPE_STORAGE: u8 = 5;

    fun is_valid_room_type(room_type: u8): bool {
        room_type == ROOM_TYPE_LIVING
            || room_type == ROOM_TYPE_GENERATOR
            || room_type == ROOM_TYPE_FARM
            || room_type == ROOM_TYPE_WATER_PUMP
            || room_type == ROOM_TYPE_WORKSHOP
            || room_type == ROOM_TYPE_STORAGE
    }

    /// Rooms that are valid for assigning workers (NPCs)
    public fun is_assignable_room_type(room_type: u8): bool {
        room_type == ROOM_TYPE_GENERATOR
            || room_type == ROOM_TYPE_FARM
            || room_type == ROOM_TYPE_WATER_PUMP
            || room_type == ROOM_TYPE_WORKSHOP
    }

    /// Convenience helper for other modules
    public fun can_assign_worker(bunker: &Bunker, room_index: u64): bool {
        let (room_type, _level, _assigned, _cap, _rate, _acc) = get_room_info(bunker, room_index);
        is_assignable_room_type(room_type)
    }

    fun avg_pct(sum_pct: u64, count: u64): u64 {
        if (count == 0) { 0 } else { sum_pct / count }
    }

    fun update_room_accumulated(room: &mut Room, current_time: u64) {
        let is_production_room = room.room_type == ROOM_TYPE_FARM
            || room.room_type == ROOM_TYPE_WATER_PUMP
            || room.room_type == ROOM_TYPE_WORKSHOP;
        if (!is_production_room) return;
        if (room.last_collected_at == 0 || room.assigned_npcs == 0) return;

        let time_elapsed = current_time - room.last_collected_at;
        let ticks = time_elapsed / PRODUCTION_TICK_MS;
        if (ticks == 0) return;

        // Apply NPC skill bonus (10-20%) tracked on the room.
        let worker_bonus_pct = avg_pct(room.work_bonus_sum_pct, room.assigned_npcs);

        // Carry fractional production forward to prevent rounding loss when collecting frequently.
        // production = (rate * workers * ticks * efficiency% * (100+bonus)% ) / (100 * 100 * ticks_per_hour)
        let denom_u128 = (100u128) * (100u128) * (PRODUCTION_TICKS_PER_HOUR as u128);
        let numerator_u128 = (room.production_rate as u128)
            * (room.assigned_npcs as u128)
            * (ticks as u128)
            * (room.efficiency as u128)
            * ((100 + worker_bonus_pct) as u128);

        let total_u128 = (room.production_remainder as u128) + numerator_u128;
        let production_u128 = total_u128 / denom_u128;
        let remainder_u128 = total_u128 % denom_u128;

        room.production_remainder = remainder_u128 as u64;
        room.accumulated = room.accumulated + (production_u128 as u64);
        room.last_collected_at = room.last_collected_at + (ticks * PRODUCTION_TICK_MS);
    }

    /// Bunker capacity is derived from the sum of capacities of all Living rooms.
    fun recalculate_bunker_capacity(bunker: &mut Bunker) {
        let mut total = 0;
        let mut i = 0;
        let len = vector::length(&bunker.rooms);
        while (i < len) {
            let room = vector::borrow(&bunker.rooms, i);
            if (room.room_type == ROOM_TYPE_LIVING) {
                total = total + room.capacity;
            };
            i = i + 1;
        };
        bunker.capacity = total;
    }

    fun apply_bunker_upgrade_bonuses(bunker: &mut Bunker) {
        let mut i = 0;
        let len = vector::length(&bunker.rooms);
        while (i < len) {
            let room = vector::borrow_mut(&mut bunker.rooms, i);

            room.efficiency = if (room.efficiency + BUNKER_UPGRADE_EFFICIENCY_BONUS > 100) { 100 }
            else { room.efficiency + BUNKER_UPGRADE_EFFICIENCY_BONUS };

            if (room.room_type == ROOM_TYPE_LIVING) {
                room.capacity = room.capacity + BUNKER_UPGRADE_LIVING_CAPACITY_BONUS;
            } else if (
                room.room_type == ROOM_TYPE_FARM
                || room.room_type == ROOM_TYPE_WATER_PUMP
                || room.room_type == ROOM_TYPE_WORKSHOP
            ) {
                room.production_rate = room.production_rate + BUNKER_UPGRADE_PRODUCTION_RATE_BONUS;
            };

            i = i + 1;
        };
    }

    // ==================== STRUCTS ====================
    
    /// Room - Phòng trong bunker (v2.0: with production tracking)
    public struct Room has store, copy, drop {
        room_type: u8,
        level: u64,
        capacity: u64,
        efficiency: u64,
        
        // Production tracking (Phase 1)
        assigned_npcs: u64,        // Số NPC đang làm việc
        production_rate: u64,      // Base rate/hour
        last_collected_at: u64,    // Timestamp lần claim cuối
        accumulated: u64,          // Production chưa claim
        production_remainder: u64, // Remainder (mod 100*ticks_per_hour)

        // Sum of per-worker work bonuses (percent) from assigned NPCs.
        // Effective bonus = avg(work_bonus_sum_pct / assigned_npcs).
        work_bonus_sum_pct: u64,

        // Engineer-only bookkeeping for Workshop repairs.
        engineer_workers: u64,
        engineer_bonus_sum_pct: u64,
    }

    /// Bunker - Căn cứ chính (v2.0: Split resources)
    public struct Bunker has key, store {
        id: UID,
        owner: address,
        name: String,
        level: u64,
        capacity: u64,
        current_npcs: u64,
        
        // ✅ Phase 1: Split resources
        food: u64,
        water: u64,
        scrap: u64,
        
        // ✅ Phase 1: Power system
        power_generation: u64,    // Tổng điện sản xuất
        power_consumption: u64,   // Tổng điện tiêu thụ
        
        rooms: vector<Room>,
    }

    /// Shared ledger to track NPC counts per bunker.
    /// Required because marketplace purchases cannot mutate the seller's owned `Bunker`.
    public struct BunkerNpcLedger has key {
        id: UID,
        counts: Table<address, u64>,
    }

    /// Initialize shared NPC ledger (called once on publish).
    fun init(ctx: &mut TxContext) {
        let ledger = BunkerNpcLedger {
            id: object::new(ctx),
            counts: table::new(ctx),
        };
        transfer::share_object(ledger);
    }

    fun ensure_bunker_entry(ledger: &mut BunkerNpcLedger, bunker_addr: address) {
        if (!table::contains(&ledger.counts, bunker_addr)) {
            table::add(&mut ledger.counts, bunker_addr, 0);
        };
    }

    public fun get_bunker_npcs(ledger: &BunkerNpcLedger, bunker_addr: address): u64 {
        if (table::contains(&ledger.counts, bunker_addr)) {
            *table::borrow(&ledger.counts, bunker_addr)
        } else {
            0
        }
    }

    public fun increment_bunker_npcs(ledger: &mut BunkerNpcLedger, bunker_addr: address) {
        ensure_bunker_entry(ledger, bunker_addr);
        let count = table::borrow_mut(&mut ledger.counts, bunker_addr);
        *count = *count + 1;
    }

    public fun decrement_bunker_npcs(ledger: &mut BunkerNpcLedger, bunker_addr: address) {
        ensure_bunker_entry(ledger, bunker_addr);
        let count = table::borrow_mut(&mut ledger.counts, bunker_addr);
        assert!(*count > 0, E_NPC_COUNT_UNDERFLOW);
        *count = *count - 1;
    }

    // ==================== INITIALIZATION ====================
    
    /// Tạo bunker mới cho người chơi (v2.0)
    public entry fun create_bunker(
        name: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Tạo các phòng ban đầu với production tracking
        let mut rooms = vector::empty<Room>();
        
        // Living Quarters - Phòng ở
        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_LIVING,
            level: 1,
            capacity: LIVING_QUARTERS_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: 0,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });
        
        // Generator - Máy phát điện
        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_GENERATOR,
            level: 1,
            capacity: PRODUCTION_ROOM_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: POWER_GENERATOR_PRODUCE,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });
        
        // Farm - Nông trại
        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_FARM,
            level: 1,
            capacity: PRODUCTION_ROOM_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: FOOD_BASE_PRODUCTION,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });
        
        // Water Pump - Máy bơm nước
        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_WATER_PUMP,
            level: 1,
            capacity: PRODUCTION_ROOM_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: WATER_BASE_PRODUCTION,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });

        let mut bunker = Bunker {
            id: object::new(ctx),
            owner: sender,
            name: string::utf8(name),
            level: 1,
            capacity: INITIAL_CAPACITY,
            current_npcs: 0,
            food: INITIAL_FOOD,
            water: INITIAL_WATER,
            scrap: INITIAL_SCRAP,
            power_generation: 0,
            power_consumption: 0,
            rooms,
        };

        // Capacity derives from Living rooms.
        recalculate_bunker_capacity(&mut bunker);
        
        let bunker_id = object::uid_to_address(&bunker.id);
        
        // Emit event
        utils::emit_bunker_upgrade_event(
            bunker_id,
            sender,
            1,
            bunker.capacity,
            clock
        );
        
        transfer::public_transfer(bunker, sender);
    }

    // ==================== UPGRADES ====================
    
    /// Nâng cấp bunker - Tăng level và capacity
    public entry fun upgrade_bunker(
        bunker: &mut Bunker,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == bunker.owner, E_NOT_OWNER);
        
        let upgrade_cost = UPGRADE_COST_BASE * bunker.level;
        assert!(bunker.scrap >= upgrade_cost, E_INSUFFICIENT_SCRAP);
        
        // Trừ scrap
        bunker.scrap = bunker.scrap - upgrade_cost;
        
        // Tăng level (capacity derives from Living rooms)
        bunker.level = bunker.level + 1;

        // Apply meaningful bonuses so bunker upgrades matter.
        apply_bunker_upgrade_bonuses(bunker);

        recalculate_bunker_capacity(bunker);

        // Ensure stored power values reflect new level/room upgrades immediately.
        recalculate_power(bunker);
        
        // Emit event
        utils::emit_bunker_upgrade_event(
            object::uid_to_address(&bunker.id),
            bunker.owner,
            bunker.level,
            bunker.capacity,
            clock
        );
    }

    /// Nâng cấp phòng cụ thể
    public entry fun upgrade_room(
        bunker: &mut Bunker,
        room_index: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == bunker.owner, E_NOT_OWNER);
        assert!(room_index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);

        // Scale room upgrade cost by current room level.
        let current_level = {
            let room = vector::borrow(&bunker.rooms, room_index);
            room.level
        };
        let room_upgrade_cost = ROOM_UPGRADE_COST_BASE * current_level;
        assert!(bunker.scrap >= room_upgrade_cost, E_INSUFFICIENT_SCRAP);
        
        // Trừ scrap
        bunker.scrap = bunker.scrap - room_upgrade_cost;

        let is_living = {
            // Lấy room và upgrade
            let room = vector::borrow_mut(&mut bunker.rooms, room_index);
            let is_living = room.room_type == ROOM_TYPE_LIVING;
            room.level = room.level + 1;
            room.capacity = room.capacity + ROOM_UPGRADE_CAPACITY_INCREASE;
            room.efficiency = if (room.efficiency + ROOM_UPGRADE_EFFICIENCY_INCREASE > 100) { 100 }
            else { room.efficiency + ROOM_UPGRADE_EFFICIENCY_INCREASE };

            // Production rooms get a direct rate boost so upgrades are noticeable.
            if (
                room.room_type == ROOM_TYPE_FARM
                || room.room_type == ROOM_TYPE_WATER_PUMP
                || room.room_type == ROOM_TYPE_WORKSHOP
            ) {
                room.production_rate = room.production_rate + ROOM_UPGRADE_PRODUCTION_RATE_INCREASE;
            };
            is_living
        };

        // Update bunker capacity if Living room changed.
        if (is_living) {
            recalculate_bunker_capacity(bunker);
        };

        // Storage upgrades affect power reduction; generator upgrades affect generation scaling.
        // Recompute power so the UI/gameplay updates immediately after upgrade.
        recalculate_power(bunker);
    }

    /// Thêm phòng mới
    public entry fun add_room(
        bunker: &mut Bunker,
        room_type: u8,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == bunker.owner, E_NOT_OWNER);
        assert!(is_valid_room_type(room_type), E_INVALID_ROOM_TYPE);
        assert!(bunker.scrap >= ADD_ROOM_COST, E_INSUFFICIENT_SCRAP);
        
        // Trừ scrap
        bunker.scrap = bunker.scrap - ADD_ROOM_COST;
        
        // Set capacity & production rate based on room type
        let capacity = if (room_type == ROOM_TYPE_LIVING) {
            LIVING_QUARTERS_CAPACITY
        } else {
            PRODUCTION_ROOM_CAPACITY
        };

        let production_rate = if (room_type == ROOM_TYPE_GENERATOR) {
            POWER_GENERATOR_PRODUCE
        } else if (room_type == ROOM_TYPE_FARM) {
            FOOD_BASE_PRODUCTION
        } else if (room_type == ROOM_TYPE_WATER_PUMP) {
            WATER_BASE_PRODUCTION
        } else if (room_type == ROOM_TYPE_WORKSHOP) {
            SCRAP_BASE_PRODUCTION
        } else {
            0
        };
        
        // Thêm phòng
        let new_room = Room {
            room_type,
            level: 1,
            capacity,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        };
        
        vector::push_back(&mut bunker.rooms, new_room);

        // Capacity derives from Living rooms.
        recalculate_bunker_capacity(bunker);
    }

    // ==================== RESOURCE MANAGEMENT (Phase 1) ====================
    
    /// Thêm food
    public fun add_food(bunker: &mut Bunker, amount: u64) {
        bunker.food = bunker.food + amount;
    }
    
    /// Thêm water
    public fun add_water(bunker: &mut Bunker, amount: u64) {
        bunker.water = bunker.water + amount;
    }
    
    /// Thêm scrap
    public fun add_scrap(bunker: &mut Bunker, amount: u64) {
        bunker.scrap = bunker.scrap + amount;
    }

    /// Tiêu thụ food
    public fun consume_food(bunker: &mut Bunker, amount: u64) {
        assert!(bunker.food >= amount, E_INSUFFICIENT_FOOD);
        bunker.food = bunker.food - amount;
    }
    
    /// Tiêu thụ water
    public fun consume_water(bunker: &mut Bunker, amount: u64) {
        assert!(bunker.water >= amount, E_INSUFFICIENT_WATER);
        bunker.water = bunker.water - amount;
    }
    
    /// Tiêu thụ scrap
    public fun consume_scrap(bunker: &mut Bunker, amount: u64) {
        assert!(bunker.scrap >= amount, E_INSUFFICIENT_SCRAP);
        bunker.scrap = bunker.scrap - amount;
    }

    /// Repair an item to full durability.
    /// Enforced here (instead of in `contracts::item`) to avoid dependency cycles.
    public entry fun repair_item(
        item: &mut item::Item,
        bunker: &mut Bunker,
        mut payment: sui::coin::Coin<sui::sui::SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        use sui::coin;

        let sender = tx_context::sender(ctx);
        assert!(get_owner(bunker) == sender, E_NOT_OWNER);

        // Must have a Workshop and sufficient power to repair.
        let workshop_opt = get_first_room_index_by_type(bunker, room_type_workshop());
        assert!(option::is_some(&workshop_opt), E_WORKSHOP_REQUIRED);
        assert!(is_power_sufficient(bunker), E_WORKSHOP_NO_POWER);
        let workshop_index = *option::borrow(&workshop_opt);
        let engineer_discount_pct = get_room_engineer_avg_bonus_pct(bunker, workshop_index);

        // Calculate damage
        let durability_lost = item::get_max_durability(item) - item::get_durability(item);
        assert!(durability_lost > 0, E_ITEM_NOT_DAMAGED);

        // Calculate costs (V2 formula)
        let scrap_cost = item::compute_repair_scrap_cost(item, engineer_discount_pct);

        // Consume scrap from bunker
        consume_scrap(bunker, scrap_cost);

        // Keep signature compatibility: return (or destroy) the provided payment coin.
        if (coin::value(&payment) > 0) { transfer::public_transfer(payment, sender); }
        else { coin::destroy_zero(payment); };

        // Restore durability
        item::set_durability_to_max(item);

        // Emit event
        utils::emit_item_repaired_event(
            object::id(item),
            sender,
            durability_lost,
            scrap_cost,
            clock
        );
    }
    
    // Legacy function for backward compatibility (will be deprecated)
    // Updated to split resources correctly: 50% Food, 25% Water, 25% Scrap
    public fun add_resources(bunker: &mut Bunker, amount: u64) {
        let food_add = amount / 2;
        let water_add = amount / 4;
        let scrap_add = amount / 4;
        
        // Add to bunker
        bunker.food = bunker.food + food_add;
        bunker.water = bunker.water + water_add;
        bunker.scrap = bunker.scrap + scrap_add;
    }
    
    public fun consume_resources(bunker: &mut Bunker, amount: u64) {
        if (bunker.scrap >= amount) {
            bunker.scrap = bunker.scrap - amount;
        } else {
            bunker.scrap = 0;
        };
    }

    // ==================== PRODUCTION & COLLECTION (Phase 1) ====================
    
    /// Thu hoạch production từ room
    public entry fun collect_production(
        bunker: &mut Bunker,
        room_index: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == bunker.owner, E_NOT_OWNER);
        assert!(room_index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        
        let room = vector::borrow_mut(&mut bunker.rooms, room_index);
        let current_time = sui::clock::timestamp_ms(clock);

        // Calculate accumulated production using 10-minute ticks and room efficiency
        update_room_accumulated(room, current_time);
        
        // Save values before borrowing bunker again
        let room_type = room.room_type;
        let accumulated_amount = room.accumulated;
        
        // Add to bunker based on room type
        if (room_type == ROOM_TYPE_FARM) {
            add_food(bunker, accumulated_amount);

            // Small cloth yield as a byproduct (minted items).
            let cloth_count = accumulated_amount / FARM_CLOTH_PER_FOOD;
            if (cloth_count > 0) {
                let mut i = 0;
                while (i < cloth_count) {
                    let cloth = item::create_cloth(ctx);
                    transfer::public_transfer(cloth, bunker.owner);
                    i = i + 1;
                };
            };
        } else if (room_type == ROOM_TYPE_WATER_PUMP) {
            add_water(bunker, accumulated_amount);
        } else if (room_type == ROOM_TYPE_WORKSHOP) {
            add_scrap(bunker, accumulated_amount);
        };
        
        // Emit event
        utils::emit_production_collected_event(
            object::uid_to_address(&bunker.id),
            room_index,
            accumulated_amount,
            room_type,
            clock
        );
        
        // Reset (need to borrow room again)
        let room = vector::borrow_mut(&mut bunker.rooms, room_index);
        room.accumulated = 0;
        // Keep last_collected_at as-is (it is advanced by update_room_accumulated)
    }

    // ==================== POWER MANAGEMENT ====================
    
    /// Calculate power balance
    public fun get_power_balance(bunker: &Bunker): (u64, u64, bool) {
        let generation = bunker.power_generation;
        let consumption = bunker.power_consumption;
        let sufficient = generation >= consumption;
        (generation, consumption, sufficient)
    }
    
    /// Check if power is sufficient
    public fun is_power_sufficient(bunker: &Bunker): bool {
        bunker.power_generation >= bunker.power_consumption
    }
    
    /// Update power generation/consumption (called when NPCs assigned/unassigned)
    public fun recalculate_power(bunker: &mut Bunker) {
        let mut total_generation = 0;
        let mut total_consumption = 0;
        let mut storage_reduction = 0;

        let bunker_level_bonus_pct = if (bunker.level > 1) {
            (bunker.level - 1) * BUNKER_POWER_BONUS_PCT_PER_LEVEL
        } else {
            0
        };
        
        let mut i = 0;
        let len = vector::length(&bunker.rooms);
        
        while (i < len) {
            let room = vector::borrow(&bunker.rooms, i);
            
            if (room.room_type == ROOM_TYPE_GENERATOR && room.assigned_npcs > 0) {
                let worker_bonus_pct = avg_pct(room.work_bonus_sum_pct, room.assigned_npcs);
                let generator_level_bonus_pct = if (room.level > 1) {
                    (room.level - 1) * GENERATOR_POWER_BONUS_PCT_PER_LEVEL
                } else {
                    0
                };

                let bonus_pct = 100 + bunker_level_bonus_pct + generator_level_bonus_pct;

                let combined_pct = (bonus_pct * (100 + worker_bonus_pct)) / 100;

                total_generation = total_generation + ((POWER_GENERATOR_PRODUCE * room.assigned_npcs * combined_pct) / 100);
                total_consumption = total_consumption + (POWER_GENERATOR_CONSUME * room.assigned_npcs);
            } else if (room.room_type == ROOM_TYPE_FARM && room.assigned_npcs > 0) {
                total_consumption = total_consumption + (POWER_FARM * room.assigned_npcs);
            } else if (room.room_type == ROOM_TYPE_WATER_PUMP && room.assigned_npcs > 0) {
                total_consumption = total_consumption + (POWER_WATER_PUMP * room.assigned_npcs);
            } else if (room.room_type == ROOM_TYPE_WORKSHOP && room.assigned_npcs > 0) {
                total_consumption = total_consumption + (POWER_WORKSHOP * room.assigned_npcs);
            };

            // Storage utility: reduce total consumption based on storage level (passive, no workers needed)
            if (room.room_type == ROOM_TYPE_STORAGE) {
                storage_reduction = storage_reduction + (STORAGE_POWER_REDUCTION_PER_LEVEL * room.level);
            };
            
            i = i + 1;
        };
        
        if (total_consumption > storage_reduction) {
            total_consumption = total_consumption - storage_reduction;
        } else {
            total_consumption = 0;
        };

        bunker.power_generation = total_generation;
        bunker.power_consumption = total_consumption;
    }

    // ==================== ROOM WORKER MANAGEMENT ====================
    
    /// Assign NPC to room (called from npc module)
    public fun increment_room_workers(
        bunker: &mut Bunker,
        room_index: u64,
        work_bonus_pct: u64,
        is_engineer: bool,
        clock: &Clock
    ) {
        assert!(room_index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        let room = vector::borrow_mut(&mut bunker.rooms, room_index);
        assert!(room.assigned_npcs < room.capacity, E_ROOM_FULL);

        let now = sui::clock::timestamp_ms(clock);

        // Accumulate production at the previous worker count before changing it.
        if (room.assigned_npcs > 0) {
            update_room_accumulated(room, now);
        } else {
            // When starting work from idle, reset timing so we don't count idle time.
            room.last_collected_at = now;
        };
        
        room.assigned_npcs = room.assigned_npcs + 1;
        room.work_bonus_sum_pct = room.work_bonus_sum_pct + work_bonus_pct;
        if (is_engineer) {
            room.engineer_workers = room.engineer_workers + 1;
            room.engineer_bonus_sum_pct = room.engineer_bonus_sum_pct + work_bonus_pct;
        };
        recalculate_power(bunker);
    }
    
    /// Unassign NPC from room (called from npc module)
    public fun decrement_room_workers(
        bunker: &mut Bunker,
        room_index: u64,
        work_bonus_pct: u64,
        is_engineer: bool,
        clock: &Clock
    ) {
        assert!(room_index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        let room = vector::borrow_mut(&mut bunker.rooms, room_index);

        if (room.assigned_npcs > 0) {
            let current_time = sui::clock::timestamp_ms(clock);
            update_room_accumulated(room, current_time);
            room.assigned_npcs = room.assigned_npcs - 1;

            // Bookkeeping for bonus sums
            assert!(room.work_bonus_sum_pct >= work_bonus_pct, 0);
            room.work_bonus_sum_pct = room.work_bonus_sum_pct - work_bonus_pct;
            if (is_engineer) {
                assert!(room.engineer_workers > 0, 0);
                assert!(room.engineer_bonus_sum_pct >= work_bonus_pct, 0);
                room.engineer_workers = room.engineer_workers - 1;
                room.engineer_bonus_sum_pct = room.engineer_bonus_sum_pct - work_bonus_pct;
            };
            recalculate_power(bunker);
        };
    }

    // ==================== GETTERS ====================
    
    public fun get_id(bunker: &Bunker): address {
        object::uid_to_address(&bunker.id)
    }

    public fun get_owner(bunker: &Bunker): address {
        bunker.owner
    }
    
    /// Get bunker address (for raid cooldown tracking)
    public fun get_address(bunker: &Bunker): address {
        object::uid_to_address(&bunker.id)
    }

    public fun get_name(bunker: &Bunker): String {

        bunker.name
    }

    public fun get_level(bunker: &Bunker): u64 {
        bunker.level
    }

    public fun get_capacity(bunker: &Bunker): u64 {
        bunker.capacity
    }
    
    // Phase 1: New getters for split resources
    public fun get_food(bunker: &Bunker): u64 {
        bunker.food
    }
    
    public fun get_water(bunker: &Bunker): u64 {
        bunker.water
    }
    
    public fun get_scrap(bunker: &Bunker): u64 {
        bunker.scrap
    }
    
    // Legacy getter (returns scrap for backward compatibility)
    public fun get_resources(bunker: &Bunker): u64 {
        bunker.scrap
    }
    
    public fun get_power_generation(bunker: &Bunker): u64 {
        bunker.power_generation
    }
    
    public fun get_power_consumption(bunker: &Bunker): u64 {
        bunker.power_consumption
    }

    public fun get_room_count(bunker: &Bunker): u64 {
        vector::length(&bunker.rooms)
    }

    public fun get_room(bunker: &Bunker, index: u64): Room {
        assert!(index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        *vector::borrow(&bunker.rooms, index)
    }
    
    /// Get room info (Phase 1: enhanced with production data)
    public fun get_room_info(bunker: &Bunker, room_index: u64): (u8, u64, u64, u64, u64, u64) {
        assert!(room_index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        let room = vector::borrow(&bunker.rooms, room_index);
        (
            room.room_type,
            room.level,
            room.assigned_npcs,
            room.capacity,
            room.production_rate,
            room.accumulated
        )
    }

    // Room getters
    public fun room_type(room: &Room): u8 { room.room_type }
    public fun room_level(room: &Room): u64 { room.level }
    public fun room_capacity(room: &Room): u64 { room.capacity }
    public fun room_efficiency(room: &Room): u64 { room.efficiency }
    public fun room_assigned_npcs(room: &Room): u64 { room.assigned_npcs }
    public fun room_production_rate(room: &Room): u64 { room.production_rate }
    public fun room_accumulated(room: &Room): u64 { room.accumulated }

    public fun room_engineer_workers(room: &Room): u64 { room.engineer_workers }
    public fun room_engineer_bonus_sum_pct(room: &Room): u64 { room.engineer_bonus_sum_pct }
    
    // Room type constants (for use in other modules)
    public fun room_type_living(): u8 { ROOM_TYPE_LIVING }
    public fun room_type_generator(): u8 { ROOM_TYPE_GENERATOR }
    public fun room_type_farm(): u8 { ROOM_TYPE_FARM }
    public fun room_type_water_pump(): u8 { ROOM_TYPE_WATER_PUMP }
    public fun room_type_workshop(): u8 { ROOM_TYPE_WORKSHOP }
    public fun room_type_storage(): u8 { ROOM_TYPE_STORAGE }

    public fun get_first_room_index_by_type(bunker: &Bunker, wanted_type: u8): Option<u64> {
        let mut i = 0;
        let len = vector::length(&bunker.rooms);
        while (i < len) {
            let room = vector::borrow(&bunker.rooms, i);
            if (room.room_type == wanted_type) {
                return option::some(i)
            };
            i = i + 1;
        };
        option::none()
    }

    public fun get_room_engineer_avg_bonus_pct(bunker: &Bunker, room_index: u64): u64 {
        assert!(room_index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        let room = vector::borrow(&bunker.rooms, room_index);
        avg_pct(room.engineer_bonus_sum_pct, room.engineer_workers)
    }

    // ==================== TEST HELPERS ====================

    #[test_only]
    /// Create a bunker for unit tests (no transfer, no events).
    public fun new_bunker_for_testing(owner: address, ctx: &mut TxContext): Bunker {
        let mut rooms = vector::empty<Room>();

        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_LIVING,
            level: 1,
            capacity: LIVING_QUARTERS_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: 0,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });

        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_GENERATOR,
            level: 1,
            capacity: PRODUCTION_ROOM_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: POWER_GENERATOR_PRODUCE,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });

        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_FARM,
            level: 1,
            capacity: PRODUCTION_ROOM_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: FOOD_BASE_PRODUCTION,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });

        vector::push_back(&mut rooms, Room {
            room_type: ROOM_TYPE_WATER_PUMP,
            level: 1,
            capacity: PRODUCTION_ROOM_CAPACITY,
            efficiency: 50,
            assigned_npcs: 0,
            production_rate: WATER_BASE_PRODUCTION,
            last_collected_at: 0,
            accumulated: 0,
            production_remainder: 0,
            work_bonus_sum_pct: 0,
            engineer_workers: 0,
            engineer_bonus_sum_pct: 0,
        });

        let mut bunker = Bunker {
            id: object::new(ctx),
            owner,
            name: string::utf8(b"Test"),
            level: 1,
            capacity: INITIAL_CAPACITY,
            current_npcs: 0,
            food: INITIAL_FOOD,
            water: INITIAL_WATER,
            scrap: INITIAL_SCRAP,
            power_generation: 0,
            power_consumption: 0,
            rooms,
        };

        recalculate_bunker_capacity(&mut bunker);
        bunker
    }

    #[test_only]
    public fun destroy_bunker_for_testing(bunker: Bunker) {
        let Bunker {
            id,
            owner: _,
            name: _,
            level: _,
            capacity: _,
            current_npcs: _,
            food: _,
            water: _,
            scrap: _,
            power_generation: _,
            power_consumption: _,
            rooms: _,
        } = bunker;
        id.delete();
    }
}
