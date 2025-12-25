// Module: bunker
// Mô tả: Quản lý Bunker - căn cứ chính của người chơi
// Bunker chứa các phòng, tài nguyên, và có thể nâng cấp
// Version 2.0: Resource system refactor (Food, Water, Scrap, Power)

module contracts::bunker {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::clock::Clock;
    use std::vector;
    use std::string::{Self, String};
    
    use contracts::utils;

    // ==================== MÃ LỖI ====================
    const E_NOT_OWNER: u64 = 300;               // Không phải chủ sở hữu
    const E_ROOM_NOT_FOUND: u64 = 302;          // Không tìm thấy phòng
    const E_INVALID_ROOM_TYPE: u64 = 303;       // Loại phòng không hợp lệ
    const E_INSUFFICIENT_FOOD: u64 = 304;       // Không đủ thức ăn
    const E_INSUFFICIENT_WATER: u64 = 305;      // Không đủ nước
    const E_INSUFFICIENT_SCRAP: u64 = 306;      // Không đủ phế liệu
    const E_ROOM_FULL: u64 = 308;               // Phòng đã đầy

    // ==================== HẰNG SỐ ====================
    
    // Tài nguyên ban đầu (Phase 1)
    const INITIAL_CAPACITY: u64 = 5;            // Sức chứa ban đầu: 5 NPCs
    const INITIAL_FOOD: u64 = 100;              // Thức ăn ban đầu
    const INITIAL_WATER: u64 = 100;             // Nước ban đầu
    const INITIAL_SCRAP: u64 = 50;              // Phế liệu ban đầu
    
    // Sức chứa phòng
    const LIVING_QUARTERS_CAPACITY: u64 = 5;    // Phòng ở: 5 NPCs
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
    const ROOM_UPGRADE_COST: u64 = 50;
    const ADD_ROOM_COST: u64 = 150;

    // Production tick (10 minutes)
    const PRODUCTION_TICK_MS: u64 = 600000;
    const PRODUCTION_TICKS_PER_HOUR: u64 = 6;

    // Storage utility (passive)
    const STORAGE_POWER_REDUCTION_PER_LEVEL: u64 = 2;
    
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

    fun update_room_accumulated(room: &mut Room, current_time: u64) {
        let is_production_room = room.room_type == ROOM_TYPE_FARM
            || room.room_type == ROOM_TYPE_WATER_PUMP
            || room.room_type == ROOM_TYPE_WORKSHOP;
        if (!is_production_room) return;
        if (room.last_collected_at == 0 || room.assigned_npcs == 0) return;

        let time_elapsed = current_time - room.last_collected_at;
        let ticks = time_elapsed / PRODUCTION_TICK_MS;
        if (ticks == 0) return;

        // Carry fractional production forward to prevent rounding loss when collecting frequently.
        // production = (rate * workers * ticks * efficiency) / (100 * ticks_per_hour)
        let denom = 100 * PRODUCTION_TICKS_PER_HOUR; // 600
        let numerator = room.production_rate * room.assigned_npcs * ticks * room.efficiency;
        let total = room.production_remainder + numerator;
        let production = total / denom;
        room.production_remainder = total % denom;
        room.accumulated = room.accumulated + production;
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

        recalculate_bunker_capacity(bunker);
        
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
        assert!(bunker.scrap >= ROOM_UPGRADE_COST, E_INSUFFICIENT_SCRAP);
        
        // Trừ scrap
        bunker.scrap = bunker.scrap - ROOM_UPGRADE_COST;

        let is_living = {
            // Lấy room và upgrade
            let room = vector::borrow_mut(&mut bunker.rooms, room_index);
            let is_living = room.room_type == ROOM_TYPE_LIVING;
            room.level = room.level + 1;
            room.capacity = room.capacity + CAPACITY_INCREASE_PER_LEVEL;
            room.efficiency = if (room.efficiency + 10 > 100) { 100 } else { room.efficiency + 10 };
            is_living
        };

        // Update bunker capacity if Living room changed.
        if (is_living) {
            recalculate_bunker_capacity(bunker);
        };
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
        
        let mut i = 0;
        let len = vector::length(&bunker.rooms);
        
        while (i < len) {
            let room = vector::borrow(&bunker.rooms, i);
            
            if (room.room_type == ROOM_TYPE_GENERATOR && room.assigned_npcs > 0) {
                total_generation = total_generation + (POWER_GENERATOR_PRODUCE * room.assigned_npcs);
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
    public fun increment_room_workers(bunker: &mut Bunker, room_index: u64, clock: &Clock) {
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
        recalculate_power(bunker);
    }
    
    /// Unassign NPC from room (called from npc module)
    public fun decrement_room_workers(bunker: &mut Bunker, room_index: u64, clock: &Clock) {
        assert!(room_index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        let room = vector::borrow_mut(&mut bunker.rooms, room_index);

        if (room.assigned_npcs > 0) {
            let current_time = sui::clock::timestamp_ms(clock);
            update_room_accumulated(room, current_time);
            room.assigned_npcs = room.assigned_npcs - 1;
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
    
    // Room type constants (for use in other modules)
    public fun room_type_living(): u8 { ROOM_TYPE_LIVING }
    public fun room_type_generator(): u8 { ROOM_TYPE_GENERATOR }
    public fun room_type_farm(): u8 { ROOM_TYPE_FARM }
    public fun room_type_water_pump(): u8 { ROOM_TYPE_WATER_PUMP }
    public fun room_type_workshop(): u8 { ROOM_TYPE_WORKSHOP }
    public fun room_type_storage(): u8 { ROOM_TYPE_STORAGE }

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
