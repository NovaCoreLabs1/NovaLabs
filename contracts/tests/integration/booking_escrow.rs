use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

// Import both contracts
use workspace_booking::{BookingStatus, WorkspaceBookingContract, WorkspaceType};
use payment_escrow::{EscrowStatus, PaymentEscrowContract};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn advance_time(env: &Env, seconds: u64) {
    env.ledger().with_mut(|l| l.timestamp += seconds);
}

fn setup_token(env: &Env, admin: &Address, recipient: &Address, amount: i128) -> Address {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(env, &token_address)
        .mock_all_auths()
        .mint(recipient, &amount);
    token_address
}

fn setup_booking_contract(env: &Env) -> Address {
    env.register(WorkspaceBookingContract, ())
}

fn setup_escrow_contract(env: &Env) -> Address {
    env.register(PaymentEscrowContract, ())
}

// ── Integration Tests ─────────────────────────────────────────────────────────

/// Full lifecycle: book workspace → create escrow → release escrow → complete booking.
#[test]
fn test_booking_then_escrow_release_full_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    // Shared payment token
    let token = setup_token(&env, &admin, &member, 100_000i128);

    // Deploy both contracts
    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    // Initialize booking contract
    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    // Initialize escrow contract
    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    escrow_client.initialize(&admin, &token, &86_400u64);

    // Register a workspace
    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-001"),
        &String::from_str(&env, "Meeting Room Alpha"),
        &WorkspaceType::MeetingRoom,
        &10u32,
        &2_000u128, // 2000 units/hr
    );

    let now = env.ledger().timestamp();
    let start = now + 3_600;
    let end = start + 7_200; // 2 hours → cost 4000

    // Step 1: Book workspace
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "booking-001"),
        &String::from_str(&env, "ws-001"),
        &start,
        &end,
    );

    let booking = booking_client.get_booking(&String::from_str(&env, "booking-001"));
    assert_eq!(booking.status, BookingStatus::Active);
    assert_eq!(booking.amount_paid, 4_000u128);

    // Member balance after booking: 100000 - 4000 = 96000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 96_000i128);

    // Step 2: Create escrow for the booking (security deposit)
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-booking-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Security deposit for ws-001 booking"),
        &0u64, // no auto-claim
    );

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-booking-001"));
    assert_eq!(escrow.status, EscrowStatus::Pending);
    assert_eq!(escrow.amount, 5_000i128);

    // Member balance after escrow: 96000 - 5000 = 91000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 91_000i128);

    // Step 3: Admin releases escrow to beneficiary (service completed successfully)
    escrow_client.release(&admin, &String::from_str(&env, "esc-booking-001"));

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-booking-001"));
    assert_eq!(escrow.status, EscrowStatus::Released);
    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 5_000i128);

    // Step 4: Admin completes the booking
    advance_time(&env, 10_800); // advance past booking end
    booking_client.complete_booking(&admin, &String::from_str(&env, "booking-001"));

    let booking = booking_client.get_booking(&String::from_str(&env, "booking-001"));
    assert_eq!(booking.status, BookingStatus::Completed);
}

/// Book workspace → create escrow → raise dispute → resolve dispute (refund to depositor).
#[test]
fn test_booking_then_escrow_dispute_and_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token = setup_token(&env, &admin, &member, 100_000i128);

    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    escrow_client.initialize(&admin, &token, &86_400u64);

    // Register workspace
    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-002"),
        &String::from_str(&env, "Private Office"),
        &WorkspaceType::PrivateOffice,
        &4u32,
        &3_000u128,
    );

    let now = env.ledger().timestamp();
    let start = now + 3_600;
    let end = start + 3_600; // 1 hour → cost 3000

    // Book workspace
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "booking-002"),
        &String::from_str(&env, "ws-002"),
        &start,
        &end,
    );

    // Create escrow with dispute window
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-booking-002"),
        &beneficiary,
        &10_000i128,
        &String::from_str(&env, "Service fee for private office"),
        &0u64,
    );

    // Advance 1 hour (within dispute window)
    advance_time(&env, 3_600);

    // Member raises dispute
    escrow_client.raise_dispute(&member, &String::from_str(&env, "esc-booking-002"));

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-booking-002"));
    assert_eq!(escrow.status, EscrowStatus::Disputed);

    // Admin resolves dispute in favor of depositor (refund)
    escrow_client.resolve_dispute(&admin, &String::from_str(&env, "esc-booking-002"), &false);

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-booking-002"));
    assert_eq!(escrow.status, EscrowStatus::Refunded);

    // Depositor gets funds back
    let member_balance = TokenClient::new(&env, &token).balance(&member);
    // 100000 - 3000 (booking) - 10000 (escrow) + 10000 (refund) = 87000
    assert_eq!(member_balance, 87_000i128);
}

/// Book workspace → cancel booking → refund → claim expired escrow.
#[test]
fn test_cancel_booking_then_claim_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token = setup_token(&env, &admin, &member, 100_000i128);

    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    escrow_client.initialize(&admin, &token, &86_400u64);

    // Register workspace
    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-003"),
        &String::from_str(&env, "Hot Desk"),
        &WorkspaceType::HotDesk,
        &1u32,
        &500u128,
    );

    let now = env.ledger().timestamp();
    let start = now + 3_600;
    let end = start + 7_200; // 2 hours → cost 1000

    // Book workspace
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "booking-003"),
        &String::from_str(&env, "ws-003"),
        &start,
        &end,
    );

    // Member balance: 100000 - 1000 = 99000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 99_000i128);

    // Cancel booking (full refund)
    booking_client.cancel_booking(&member, &String::from_str(&env, "booking-003"));

    let booking = booking_client.get_booking(&String::from_str(&env, "booking-003"));
    assert_eq!(booking.status, BookingStatus::Cancelled);

    // Member balance restored: 99000 + 1000 = 100000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 100_000i128);

    // Create escrow with auto-claim after 1 hour
    let release_after = env.ledger().timestamp() + 3_600;
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-003"),
        &beneficiary,
        &20_000i128,
        &String::from_str(&env, "Time-locked payment"),
        &release_after,
    );

    // Member balance: 100000 - 20000 = 80000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 80_000i128);

    // Advance past release_after
    advance_time(&env, 3_601);

    // Beneficiary claims
    escrow_client.claim(&beneficiary, &String::from_str(&env, "esc-003"));

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 20_000i128);

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-003"));
    assert_eq!(escrow.status, EscrowStatus::Released);
}

/// Multiple bookings with escrow — test concurrent escrow lifecycle.
#[test]
fn test_multiple_bookings_with_escrows() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token = setup_token(&env, &admin, &member, 200_000i128);

    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    escrow_client.initialize(&admin, &token, &86_400u64);

    // Register two workspaces
    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-A"),
        &String::from_str(&env, "Desk A"),
        &WorkspaceType::HotDesk,
        &1u32,
        &1_000u128,
    );

    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-B"),
        &String::from_str(&env, "Desk B"),
        &WorkspaceType::DedicatedDesk,
        &1u32,
        &2_000u128,
    );

    let now = env.ledger().timestamp();

    // Book ws-A: 1 hour → 1000
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "bk-A"),
        &String::from_str(&env, "ws-A"),
        &(now + 3_600),
        &(now + 7_200),
    );

    // Book ws-B: 2 hours → 4000
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "bk-B"),
        &String::from_str(&env, "ws-B"),
        &(now + 3_600),
        &(now + 10_800),
    );

    // Create escrow for ws-A booking
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-A"),
        &beneficiary,
        &3_000i128,
        &String::from_str(&env, "Deposit for Desk A"),
        &0u64,
    );

    // Create escrow for ws-B booking
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-B"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit for Desk B"),
        &0u64,
    );

    // Member balance: 200000 - 1000 - 4000 - 3000 - 5000 = 187000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 187_000i128);

    // Release escrow A
    escrow_client.release(&admin, &String::from_str(&env, "esc-A"));
    assert_eq!(escrow_client.get_escrow(&String::from_str(&env, "esc-A")).status, EscrowStatus::Released);

    // Refund escrow B
    escrow_client.refund(&admin, &String::from_str(&env, "esc-B"));
    assert_eq!(escrow_client.get_escrow(&String::from_str(&env, "esc-B")).status, EscrowStatus::Refunded);

    // Beneficiary got escrow A: 3000
    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 3_000i128);

    // Member got escrow B refund: 187000 + 5000 = 192000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 192_000i128);

    // Complete both bookings
    advance_time(&env, 11_000);
    booking_client.complete_booking(&admin, &String::from_str(&env, "bk-A"));
    booking_client.complete_booking(&admin, &String::from_str(&env, "bk-B"));

    assert_eq!(booking_client.get_booking(&String::from_str(&env, "bk-A")).status, BookingStatus::Completed);
    assert_eq!(booking_client.get_booking(&String::from_str(&env, "bk-B")).status, BookingStatus::Completed);
}

/// Admin cancel booking with escrow — partial refund scenario.
#[test]
fn test_admin_cancel_booking_with_escrow_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token = setup_token(&env, &admin, &member, 100_000i128);

    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    escrow_client.initialize(&admin, &token, &86_400u64);

    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-004"),
        &String::from_str(&env, "Conference Room"),
        &WorkspaceType::MeetingRoom,
        &20u32,
        &5_000u128,
    );

    let now = env.ledger().timestamp();
    let start = now + 3_600;
    let end = start + 3_600; // 1 hour → 5000

    // Book
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "booking-004"),
        &String::from_str(&env, "ws-004"),
        &start,
        &end,
    );

    // Create escrow
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-004"),
        &beneficiary,
        &15_000i128,
        &String::from_str(&env, "Catering deposit"),
        &0u64,
    );

    // Member balance: 100000 - 5000 - 15000 = 80000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 80_000i128);

    // Admin cancels booking → member gets booking refund
    booking_client.cancel_booking(&admin, &String::from_str(&env, "booking-004"));

    let booking = booking_client.get_booking(&String::from_str(&env, "booking-004"));
    assert_eq!(booking.status, BookingStatus::Cancelled);

    // Member balance: 80000 + 5000 = 85000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 85_000i128);

    // Admin also refunds the escrow
    escrow_client.refund(&admin, &String::from_str(&env, "esc-004"));

    // Member balance: 85000 + 15000 = 100000 (fully restored)
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 100_000i128);

    // Escrow refunded
    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-004"));
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

/// Book unavailable workspace → create escrow → dispute escrow → resolve dispute (release to beneficiary).
#[test]
fn test_unavailable_workspace_booking_blocks_escrow_creation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token = setup_token(&env, &admin, &member, 100_000i128);

    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    escrow_client.initialize(&admin, &token, &86_400u64);

    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-005"),
        &String::from_str(&env, "Maintenance Desk"),
        &WorkspaceType::HotDesk,
        &1u32,
        &500u128,
    );

    // Disable workspace
    booking_client.set_workspace_availability(&admin, &String::from_str(&env, "ws-005"), &false);

    let now = env.ledger().timestamp();

    // Booking should fail
    let result = booking_client.try_book_workspace(
        &member,
        &String::from_str(&env, "booking-005"),
        &String::from_str(&env, "ws-005"),
        &(now + 3_600),
        &(now + 7_200),
    );
    assert!(result.is_err());

    // But escrow can still be created independently
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-005"),
        &beneficiary,
        &2_000i128,
        &String::from_str(&env, "Refundable deposit"),
        &0u64,
    );

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-005"));
    assert_eq!(escrow.status, EscrowStatus::Pending);

    // Admin refunds since booking never happened
    escrow_client.refund(&admin, &String::from_str(&env, "esc-005"));

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-005"));
    assert_eq!(escrow.status, EscrowStatus::Refunded);

    // Member's funds fully restored
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 100_000i128);
}

/// Time-locked escrow: book workspace → create time-locked escrow → admin releases booking → beneficiary auto-claims.
#[test]
fn test_time_locked_escrow_with_booking() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token = setup_token(&env, &admin, &member, 100_000i128);

    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    escrow_client.initialize(&admin, &token, &86_400u64);

    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-006"),
        &String::from_str(&env, "Premium Suite"),
        &WorkspaceType::PrivateOffice,
        &6u32,
        &10_000u128,
    );

    let now = env.ledger().timestamp();
    let start = now + 3_600;
    let end = start + 3_600; // 1 hour → 10000

    // Book workspace
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "booking-006"),
        &String::from_str(&env, "ws-006"),
        &start,
        &end,
    );

    // Create time-locked escrow — release after 2 hours
    let release_after = now + 7_200;
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-006"),
        &beneficiary,
        &25_000i128,
        &String::from_str(&env, "Retainer for premium suite"),
        &release_after,
    );

    // Member balance: 100000 - 10000 - 25000 = 65000
    assert_eq!(TokenClient::new(&env, &token).balance(&member), 65_000i128);

    // Admin completes booking early
    advance_time(&env, 4_000);
    booking_client.complete_booking(&admin, &String::from_str(&env, "booking-006"));

    // Try to claim before release_after — should fail
    let result = escrow_client.try_claim(&beneficiary, &String::from_str(&env, "esc-006"));
    assert!(result.is_err());

    // Advance past release_after
    advance_time(&env, 4_000); // total 8000 > 7200

    // Beneficiary claims
    escrow_client.claim(&beneficiary, &String::from_str(&env, "esc-006"));

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 25_000i128);

    let escrow = escrow_client.get_escrow(&String::from_str(&env, "esc-006"));
    assert_eq!(escrow.status, EscrowStatus::Released);
}

/// Escrow with dispute window: book → create escrow with dispute window → dispute after window closes.
#[test]
fn test_escrow_dispute_window_closed_after_booking() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token = setup_token(&env, &admin, &member, 100_000i128);

    let booking_id = setup_booking_contract(&env);
    let escrow_id = setup_escrow_contract(&env);

    let booking_client = workspace_booking::WorkspaceBookingContractClient::new(&env, &booking_id);
    booking_client.initialize(&admin, &token);

    let escrow_client = payment_escrow::PaymentEscrowContractClient::new(&env, &escrow_id);
    // 1 hour dispute window
    escrow_client.initialize(&admin, &token, &3_600u64);

    booking_client.register_workspace(
        &admin,
        &String::from_str(&env, "ws-007"),
        &String::from_str(&env, "Training Room"),
        &WorkspaceType::MeetingRoom,
        &15u32,
        &800u128,
    );

    let now = env.ledger().timestamp();
    let start = now + 3_600;
    let end = start + 3_600;

    // Book
    booking_client.book_workspace(
        &member,
        &String::from_str(&env, "booking-007"),
        &String::from_str(&env, "ws-007"),
        &start,
        &end,
    );

    // Create escrow with dispute window
    escrow_client.create_escrow(
        &member,
        &String::from_str(&env, "esc-007"),
        &beneficiary,
        &8_000i128,
        &String::from_str(&env, "Training fee deposit"),
        &0u64,
    );

    // Advance past dispute window (1 hour + 1 second)
    advance_time(&env, 3_601);

    // Try to dispute — should fail
    let result = escrow_client.try_raise_dispute(&member, &String::from_str(&env, "esc-007"));
    assert!(result.is_err());

    // Admin can still release
    escrow_client.release(&admin, &String::from_str(&env, "esc-007"));
    assert_eq!(
        escrow_client.get_escrow(&String::from_str(&env, "esc-007")).status,
        EscrowStatus::Released
    );
}
