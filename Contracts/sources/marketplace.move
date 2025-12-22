// Module: marketplace
// Mô tả: Phase 2 - Economy System
// Marketplace cho NPC, Item, và Resource Bundles với 2% platform fee

module contracts::marketplace {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::Clock;
    use sui::table::{Self, Table};
    use sui::dynamic_object_field;
    
    use contracts::utils;
    use contracts::npc::{Self, NPC};
    use contracts::item::{Self, Item};
    use contracts::bunker::{Self, Bunker};
    
    // ==================== MÃ LỖI ====================
    const E_NOT_SELLER: u64 = 800;              // Không phải người bán
    const E_LISTING_NOT_FOUND: u64 = 801;       // Không tìm thấy listing
    const E_INSUFFICIENT_PAYMENT: u64 = 802;    // Thanh toán không đủ
    const E_NPC_NOT_IDLE: u64 = 803;            // NPC không rảnh
    const E_NPC_HAS_ITEMS: u64 = 804;           // NPC đang mang vật phẩm
    const E_INVALID_RESOURCE_TYPE: u64 = 806;   // Loại tài nguyên không hợp lệ
    const E_NPC_KNOCKED: u64 = 807;             // NPC đang bị hạ gục
    const E_NOT_OWNER: u64 = 808;               // Không phải chủ sở hữu

    
    // ==================== CONSTANTS ====================
    
    // Platform fee: 2% = 200 basis points (out of 10000)
    const PLATFORM_FEE_PERCENT: u64 = 200;
    
    // Resource bundle sizes (approved defaults)
    const FOOD_CRATE_SIZE: u64 = 100;
    const WATER_CRATE_SIZE: u64 = 100;
    const SCRAP_CRATE_SIZE: u64 = 50;
    
    // Resource types
    const RESOURCE_TYPE_FOOD: u8 = 0;
    const RESOURCE_TYPE_WATER: u8 = 1;
    const RESOURCE_TYPE_SCRAP: u8 = 2;
    
    // ==================== STRUCTS ====================
    
    /// Global marketplace - Shared Object
    public struct Marketplace has key {
        id: UID,
        npc_listings: Table<ID, NPCListing>,
        item_listings: Table<ID, ItemListing>,
        bundle_listings: Table<ID, BundleListing>,
        platform_fee_percent: u64,  // 200 = 2%
        total_volume_sui: u64,       // Total SUI traded
    }
    
    /// NPC listing
    public struct NPCListing has store, drop {
        npc_id: ID,
        seller: address,
        price: u64,           // In MIST
        listed_at: u64,       // Timestamp
    }
    
    /// Item listing
    public struct ItemListing has store, drop {
        item_id: ID,
        seller: address,
        price: u64,
        listed_at: u64,
    }
    
    /// Resource bundle listing
    public struct BundleListing has key, store {
        id: UID,
        seller: address,
        resource_type: u8,    // 0=Food, 1=Water, 2=Scrap
        amount: u64,
        price: u64,
        listed_at: u64,
    }
    
    // ==================== INITIALIZATION ====================
    
    /// Initialize marketplace (called once on publish)
    fun init(ctx: &mut TxContext) {
        let marketplace = Marketplace {
            id: object::new(ctx),
            npc_listings: table::new(ctx),
            item_listings: table::new(ctx),
            bundle_listings: table::new(ctx),
            platform_fee_percent: PLATFORM_FEE_PERCENT,
            total_volume_sui: 0,
        };
        
        // Make shared so everyone can access
        transfer::share_object(marketplace);
    }
    
    // ==================== NPC TRADING ====================
    
    /// List NPC for sale
    public entry fun list_npc(
        marketplace: &mut Marketplace,
        npc: NPC,
        price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Validation
        assert!(npc::get_owner(&npc) == sender, E_NOT_OWNER);
        assert!(npc::get_status(&npc) == 0, E_NPC_NOT_IDLE); // STATUS_IDLE = 0
        assert!(npc::get_equipped_slots_count(&npc) == 0, E_NPC_HAS_ITEMS);
        assert!(!npc::is_knocked(&npc), E_NPC_KNOCKED);
        
        let npc_id = object::id(&npc);
        
        let listing = NPCListing {
            npc_id,
            seller: sender,
            price,
            listed_at: sui::clock::timestamp_ms(clock),
        };
        
        // Add to listings table
        table::add(&mut marketplace.npc_listings, npc_id, listing);
        
        // Store NPC in marketplace using dynamic field (escrow)
        dynamic_object_field::add(&mut marketplace.id, npc_id, npc);
        
        // Emit event
        utils::emit_npc_listed_event(npc_id, sender, price, clock);
    }
    
    /// Buy NPC
    public entry fun buy_npc(
        marketplace: &mut Marketplace,
        npc_id: ID,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&marketplace.npc_listings, npc_id), E_LISTING_NOT_FOUND);
        
        let listing = table::remove(&mut marketplace.npc_listings, npc_id);
        let buyer = tx_context::sender(ctx);
        
        // Verify payment sufficient
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= listing.price, E_INSUFFICIENT_PAYMENT);
        
        // Calculate fee: 2% of price
        let fee = (listing.price * marketplace.platform_fee_percent) / 10000;
        let seller_amount = listing.price - fee;
        
        // Split payment
        let fee_coin = coin::split(&mut payment, fee, ctx);
        let seller_coin = coin::split(&mut payment, seller_amount, ctx);
        
        // Burn fee (deflationary tokenomics)
        transfer::public_transfer(fee_coin, @0x0);
        
        // Send to seller
        transfer::public_transfer(seller_coin, listing.seller);
        
        // Return excess to buyer
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };
        
        // Transfer NPC from escrow to buyer
        let npc: NPC = dynamic_object_field::remove(&mut marketplace.id, npc_id);
        transfer::public_transfer(npc, buyer);
        
        // Update stats
        marketplace.total_volume_sui = marketplace.total_volume_sui + listing.price;
        
        // Emit event
        utils::emit_npc_sold_event(npc_id, listing.seller, buyer, listing.price, fee, clock);
    }
    
    /// Delist NPC
    public entry fun delist_npc(
        marketplace: &mut Marketplace,
        npc_id: ID,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&marketplace.npc_listings, npc_id), E_LISTING_NOT_FOUND);
        
        let listing = table::remove(&mut marketplace.npc_listings, npc_id);
        let sender = tx_context::sender(ctx);
        
        assert!(listing.seller == sender, E_NOT_SELLER);
        
        // Return NPC from escrow
        let npc: NPC = dynamic_object_field::remove(&mut marketplace.id, npc_id);
        transfer::public_transfer(npc, sender);
    }
    
    // ==================== ITEM TRADING ====================
    
    /// List Item for sale
    public entry fun list_item(
        marketplace: &mut Marketplace,
        item: Item,
        price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let item_id = object::id(&item);
        
        let listing = ItemListing {
            item_id,
            seller: sender,
            price,
            listed_at: sui::clock::timestamp_ms(clock),
        };
        
        table::add(&mut marketplace.item_listings, item_id, listing);
        
        // Store item in escrow
        dynamic_object_field::add(&mut marketplace.id, item_id, item);
        
        utils::emit_item_listed_event(item_id, sender, price, clock);
    }
    
    /// Buy Item
    public entry fun buy_item(
        marketplace: &mut Marketplace,
        item_id: ID,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&marketplace.item_listings, item_id), E_LISTING_NOT_FOUND);
        
        let listing = table::remove(&mut marketplace.item_listings, item_id);
        let buyer = tx_context::sender(ctx);
        
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= listing.price, E_INSUFFICIENT_PAYMENT);
        
        let fee = (listing.price * marketplace.platform_fee_percent) / 10000;
        let seller_amount = listing.price - fee;
        
        let fee_coin = coin::split(&mut payment, fee, ctx);
        let seller_coin = coin::split(&mut payment, seller_amount, ctx);
        
        // Burn fee
        transfer::public_transfer(fee_coin, @0x0);
        transfer::public_transfer(seller_coin, listing.seller);
        
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };
        
        // Transfer item
        let item: Item = dynamic_object_field::remove(&mut marketplace.id, item_id);
        transfer::public_transfer(item, buyer);
        
        marketplace.total_volume_sui = marketplace.total_volume_sui + listing.price;
        
        utils::emit_item_sold_event(item_id, listing.seller, buyer, listing.price, fee, clock);
    }
    
    /// Delist Item
    public entry fun delist_item(
        marketplace: &mut Marketplace,
        item_id: ID,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&marketplace.item_listings, item_id), E_LISTING_NOT_FOUND);
        
        let listing = table::remove(&mut marketplace.item_listings, item_id);
        assert!(listing.seller == tx_context::sender(ctx), E_NOT_SELLER);
        
        let item: Item = dynamic_object_field::remove(&mut marketplace.id, item_id);
        transfer::public_transfer(item, listing.seller);
    }
    
    // ==================== RESOURCE BUNDLE TRADING ====================
    
    /// Create resource bundle for sale
    public entry fun create_resource_bundle(
        marketplace: &mut Marketplace,
        bunker: &mut Bunker,
        resource_type: u8,
        price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(bunker::get_owner(bunker) == sender, E_NOT_OWNER);
        
        // Determine amount & consume from bunker
        let amount = if (resource_type == RESOURCE_TYPE_FOOD) {
            bunker::consume_food(bunker, FOOD_CRATE_SIZE);
            FOOD_CRATE_SIZE
        } else if (resource_type == RESOURCE_TYPE_WATER) {
            bunker::consume_water(bunker, WATER_CRATE_SIZE);
            WATER_CRATE_SIZE
        } else if (resource_type == RESOURCE_TYPE_SCRAP) {
            bunker::consume_scrap(bunker, SCRAP_CRATE_SIZE);
            SCRAP_CRATE_SIZE
        } else {
            abort E_INVALID_RESOURCE_TYPE
        };
        
        let listing = BundleListing {
            id: object::new(ctx),
            seller: sender,
            resource_type,
            amount,
            price,
            listed_at: sui::clock::timestamp_ms(clock),
        };
        
        let listing_id = object::id(&listing);
        
        utils::emit_bundle_listed_event(listing_id, sender, resource_type, amount, price, clock);
        
        table::add(&mut marketplace.bundle_listings, listing_id, listing);
    }
    
    /// Buy resource bundle
    public entry fun buy_resource_bundle(
        marketplace: &mut Marketplace,
        listing_id: ID,
        bunker: &mut Bunker,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&marketplace.bundle_listings, listing_id), E_LISTING_NOT_FOUND);
        
        let listing = table::remove(&mut marketplace.bundle_listings, listing_id);
        let buyer = tx_context::sender(ctx);
        
        assert!(bunker::get_owner(bunker) == buyer, E_NOT_OWNER);
        
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= listing.price, E_INSUFFICIENT_PAYMENT);
        
        let fee = (listing.price * marketplace.platform_fee_percent) / 10000;
        let seller_amount = listing.price - fee;
        
        let fee_coin = coin::split(&mut payment, fee, ctx);
        let seller_coin = coin::split(&mut payment, seller_amount, ctx);
        
        transfer::public_transfer(fee_coin, @0x0);
        transfer::public_transfer(seller_coin, listing.seller);
        
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };
        
        // Add resources to buyer's bunker
        if (listing.resource_type == RESOURCE_TYPE_FOOD) {
            bunker::add_food(bunker, listing.amount);
        } else if (listing.resource_type == RESOURCE_TYPE_WATER) {
            bunker::add_water(bunker, listing.amount);
        } else if (listing.resource_type == RESOURCE_TYPE_SCRAP) {
            bunker::add_scrap(bunker, listing.amount);
        };
        
        // Track volume
        marketplace.total_volume_sui = marketplace.total_volume_sui + listing.price;
        
        utils::emit_bundle_sold_event(listing_id, listing.seller, buyer, listing.resource_type, listing.amount, listing.price, fee, clock);
        
        // Destroy listing object
        let BundleListing { id, seller: _, resource_type: _, amount: _, price: _, listed_at: _ } = listing;
        object::delete(id);
    }
    
    /// Cancel resource bundle
    public entry fun cancel_resource_bundle(
        marketplace: &mut Marketplace,
        listing_id: ID,
        bunker: &mut Bunker,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&marketplace.bundle_listings, listing_id), E_LISTING_NOT_FOUND);
        
        let listing = table::remove(&mut marketplace.bundle_listings, listing_id);
        let sender = tx_context::sender(ctx);
        
        assert!(listing.seller == sender, E_NOT_SELLER);
        assert!(bunker::get_owner(bunker) == sender, E_NOT_OWNER);
        
        // Return resources to bunker
        if (listing.resource_type == RESOURCE_TYPE_FOOD) {
            bunker::add_food(bunker, listing.amount);
        } else if (listing.resource_type == RESOURCE_TYPE_WATER) {
            bunker::add_water(bunker, listing.amount);
        } else if (listing.resource_type == RESOURCE_TYPE_SCRAP) {
            bunker::add_scrap(bunker, listing.amount);
        };
        
        // Destroy listing
        let BundleListing { id, seller: _, resource_type: _, amount: _, price: _, listed_at: _ } = listing;
        object::delete(id);
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /// Get marketplace stats
    public fun get_marketplace_stats(marketplace: &Marketplace): (u64, u64, u64, u64) {
        (
            table::length(&marketplace.npc_listings),
            table::length(&marketplace.item_listings),
            table::length(&marketplace.bundle_listings),
            marketplace.total_volume_sui,
        )
    }
    
    /// Check if NPC is listed
    public fun is_npc_listed(marketplace: &Marketplace, npc_id: ID): bool {
        table::contains(&marketplace.npc_listings, npc_id)
    }
    
    /// Get NPC listing details
    public fun get_npc_listing(marketplace: &Marketplace, npc_id: ID): (address, u64, u64) {
        assert!(table::contains(&marketplace.npc_listings, npc_id), E_LISTING_NOT_FOUND);
        let listing = table::borrow(&marketplace.npc_listings, npc_id);
        (listing.seller, listing.price, listing.listed_at)
    }
    
    /// Check if Item is listed
    public fun is_item_listed(marketplace: &Marketplace, item_id: ID): bool {
        table::contains(&marketplace.item_listings, item_id)
    }
    
    /// Get Item listing details
    public fun get_item_listing(marketplace: &Marketplace, item_id: ID): (address, u64, u64) {
        assert!(table::contains(&marketplace.item_listings, item_id), E_LISTING_NOT_FOUND);
        let listing = table::borrow(&marketplace.item_listings, item_id);
        (listing.seller, listing.price, listing.listed_at)
    }
    
    /// Get Bundle listing details
    public fun get_bundle_listing(marketplace: &Marketplace, listing_id: ID): (address, u8, u64, u64, u64) {
        assert!(table::contains(&marketplace.bundle_listings, listing_id), E_LISTING_NOT_FOUND);
        let listing = table::borrow(&marketplace.bundle_listings, listing_id);
        (listing.seller, listing.resource_type, listing.amount, listing.price, listing.listed_at)
    }
    
    /// Get platform fee percent
    public fun get_platform_fee_percent(marketplace: &Marketplace): u64 {
        marketplace.platform_fee_percent
    }
}
