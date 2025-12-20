// Module: bunker
// Mô tả: Quản lý Bunker - căn cứ chính của người chơi
// Bunker chứa các phòng, tài nguyên, và có thể nâng cấp

module contracts::bunker {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::clock::Clock;
    use std::vector;
    use std::string::{Self, String};
    
    use contracts::utils;

    // ==================== ERROR CODES ====================
    const E_NOT_OWNER: u64 = 300;
    const E_INSUFFICIENT_RESOURCES: u64 = 301;
    const E_ROOM_NOT_FOUND: u64 = 302;
    const E_MAX_CAPACITY_REACHED: u64 = 303;

    // ==================== CONSTANTS ====================
    const INITIAL_CAPACITY: u64 = 5;       // Bunker ban đầu chứa được 5 NPCs
    const INITIAL_RESOURCES: u64 = 100;    // Tài nguyên ban đầu
    const UPGRADE_COST_BASE: u64 = 100;    // Chi phí nâng cấp cơ bản
    const ROOM_UPGRADE_COST: u64 = 50;     // Chi phí nâng cấp phòng

    // ==================== STRUCTS ====================
    
    /// Room - Phòng trong bunker
    public struct Room has store, copy, drop {
        room_type: u8,      // 0=LivingQuarters, 1=Storage, 2=Generator, 3=Medbay, 4=Workshop
        level: u64,         // Level của phòng
        capacity: u64,      // Sức chứa (số NPC có thể work)
        efficiency: u64,    // Hiệu suất (0-100)
    }

    /// Bunker - Căn cứ chính
    public struct Bunker has key, store {
        id: UID,
        owner: address,
        name: String,
        level: u64,              // Level tổng thể của bunker
        capacity: u64,           // Tổng số NPC có thể chứa
        current_npcs: u64,       // Số NPC hiện tại (tracked off-chain thường)
        resources: u64,          // Tài nguyên (food, water, materials combined)
        power: u64,              // Điện năng (0-100)
        rooms: vector<Room>,     // Danh sách các phòng
    }

    // ==================== INITIALIZATION ====================
    
    /// Tạo bunker mới cho người chơi
    public entry fun create_bunker(
        name: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Tạo các phòng ban đầu
        let mut rooms = vector::empty<Room>();
        
        // Living Quarters - Phòng ở
        vector::push_back(&mut rooms, Room {
            room_type: 0,
            level: 1,
            capacity: 3,
            efficiency: 50,
        });
        
        // Storage - Kho
        vector::push_back(&mut rooms, Room {
            room_type: 1,
            level: 1,
            capacity: 2,
            efficiency: 50,
        });
        
        // Generator - Máy phát điện
        vector::push_back(&mut rooms, Room {
            room_type: 2,
            level: 1,
            capacity: 2,
            efficiency: 50,
        });
        
        let bunker = Bunker {
            id: object::new(ctx),
            owner: sender,
            name: string::utf8(name),
            level: 1,
            capacity: INITIAL_CAPACITY,
            current_npcs: 0,
            resources: INITIAL_RESOURCES,
            power: 50,
            rooms,
        };
        
        let bunker_id = object::uid_to_address(&bunker.id);
        
        // Emit event
        utils::emit_bunker_upgrade_event(
            bunker_id,
            sender,
            1,
            INITIAL_CAPACITY,
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
        assert!(bunker.resources >= upgrade_cost, E_INSUFFICIENT_RESOURCES);
        
        // Trừ tài nguyên
        bunker.resources = bunker.resources - upgrade_cost;
        
        // Tăng level và capacity
        bunker.level = bunker.level + 1;
        bunker.capacity = bunker.capacity + 2;
        
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
        assert!(bunker.resources >= ROOM_UPGRADE_COST, E_INSUFFICIENT_RESOURCES);
        
        // Trừ tài nguyên
        bunker.resources = bunker.resources - ROOM_UPGRADE_COST;
        
        // Lấy room và upgrade
        let room = vector::borrow_mut(&mut bunker.rooms, room_index);
        room.level = room.level + 1;
        room.capacity = room.capacity + 1;
        room.efficiency = if (room.efficiency + 10 > 100) { 100 } else { room.efficiency + 10 };
    }

    /// Thêm phòng mới
    public entry fun add_room(
        bunker: &mut Bunker,
        room_type: u8,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == bunker.owner, E_NOT_OWNER);
        
        let cost = 150; // Chi phí xây phòng mới
        assert!(bunker.resources >= cost, E_INSUFFICIENT_RESOURCES);
        
        // Trừ tài nguyên
        bunker.resources = bunker.resources - cost;
        
        // Thêm phòng
        let new_room = Room {
            room_type,
            level: 1,
            capacity: 2,
            efficiency: 50,
        };
        
        vector::push_back(&mut bunker.rooms, new_room);
    }

    // ==================== RESOURCE MANAGEMENT ====================
    
    /// Thêm tài nguyên (từ expedition hoặc production)
    public fun add_resources(bunker: &mut Bunker, amount: u64) {
        bunker.resources = bunker.resources + amount;
    }

    /// Tiêu tốn tài nguyên
    public fun consume_resources(bunker: &mut Bunker, amount: u64) {
        if (bunker.resources >= amount) {
            bunker.resources = bunker.resources - amount;
        } else {
            bunker.resources = 0;
        };
    }

    /// Cập nhật power
    public fun set_power(bunker: &mut Bunker, power: u64) {
        bunker.power = if (power > 100) { 100 } else { power };
    }

    /// Increase power
    public entry fun increase_power(bunker: &mut Bunker, amount: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == bunker.owner, E_NOT_OWNER);
        bunker.power = if (bunker.power + amount > 100) { 100 } else { bunker.power + amount };
    }

    /// Đổi tên bunker
    public entry fun rename_bunker(
        bunker: &mut Bunker,
        new_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == bunker.owner, E_NOT_OWNER);
        bunker.name = string::utf8(new_name);
    }

    // ==================== GETTERS ====================
    
    public fun get_id(bunker: &Bunker): address {
        object::uid_to_address(&bunker.id)
    }

    public fun get_owner(bunker: &Bunker): address {
        bunker.owner
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

    public fun get_resources(bunker: &Bunker): u64 {
        bunker.resources
    }

    public fun get_power(bunker: &Bunker): u64 {
        bunker.power
    }

    public fun get_room_count(bunker: &Bunker): u64 {
        vector::length(&bunker.rooms)
    }

    public fun get_room(bunker: &Bunker, index: u64): Room {
        assert!(index < vector::length(&bunker.rooms), E_ROOM_NOT_FOUND);
        *vector::borrow(&bunker.rooms, index)
    }

    // Room getters
    public fun room_type(room: &Room): u8 { room.room_type }
    public fun room_level(room: &Room): u64 { room.level }
    public fun room_capacity(room: &Room): u64 { room.capacity }
    public fun room_efficiency(room: &Room): u64 { room.efficiency }
}
