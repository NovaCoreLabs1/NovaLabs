#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::Address as _, token::StellarAssetClient, Address, Env, String,
};
use payment_escrow::{PaymentEscrowContract, PaymentEscrowContractClient};
use workspace_booking::{WorkspaceBookingContract, WorkspaceBookingContractClient, WorkspaceType};

// ── Helpers ──────────────────────────────────────────────────────────────────

fn create_test_env() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let member = Address::generate(&env);
    let operator = Address::generate(&env);

    (env, admin, member, operator)
}

fn create_token(env: &Env, admin: &Address) -> (Address, StellarAssetClient) {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_client = StellarAssetClient::new(&env, &token_address);
    (token_address, token_client)
}

fn setup_booking_contract(
    env: &Env,
    admin: &Address,
    token_address: &Address,
) -> WorkspaceBookingContractClient {
    let contract_id = env.register(WorkspaceBookingContract, ());
    let client = WorkspaceBookingContractClient::new(&env, &contract_id);
    client.initialize(admin, token_address);
    client
}

fn setup_escrow_contract(
    env: &Env,
    admin: &Address,
    token_address: &Address,
) -> PaymentEscrowContractClient {
    let contract_id = env.register(PaymentEscrowContract, ());
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    client.initialize(admin, token_address, &3600u64); // 1 hour dispute window
    client
}

fn register_workspace(
    env: &Env,
    client: &WorkspaceBookingContractClient,
    admin: &Address,
) -> String {
    let ws_id = String::from_str(env, "ws-001");
    let ws_name = String::from_str(env, "Meeting Room Alpha");
    client.register_workspace(
        admin,
        &ws_id,
        &ws_name,
        &WorkspaceType::MeetingRoom,
        &4u32,
        &5000u128, // 5000 units per hour
    );
    ws_id
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_booking_then_escrow_deposit_release() {
    let (env, admin, member, operator) = create_test_env();
    let (token_address, token) = create_token(&env, &admin);

    let booking_client = setup_booking_contract(&env, &admin, &token_address);
    let escrow_client = setup_escrow_contract(&env, &admin, &token_address);

    // Register workspace
    let ws_id = register_workspace(&env, &booking_client, &admin);

    // Mint tokens to member and operator
    token.mint(&member, &100_000);
    token.mint(&operator, &100_000);

    // Advance ledger time
    env.ledger().with_mut(|l| l.timestamp = 1000);

    // Member books workspace (2 hours = 10000 units)
    let booking_id = String::from_str(&env, "bk-001");
    let start_time: u64 = 1000;
    let end_time: u64 = 1000 + 7200; // 2 hours

    booking_client.book_workspace(
        &member,
        &booking_id,
        &ws_id,
        &start_time,
        &end_time,
    );

    let booking = booking_client.get_booking(&booking_id);
    assert_eq!(booking.amount_paid, 10000u128);
    assert_eq!(booking.status, workspace_booking::BookingStatus::Active);

    // Member creates security deposit escrow (beneficiary = operator/hub)
    let escrow_id = String::from_str(&env, "esc-001");
    let deposit_amount: i128 = 5000;
    let description = String::from_str(&env, "Security deposit for booking bk-001");

    escrow_client.create_escrow(
        &member,
        &escrow_id,
        &operator,
        &deposit_amount,
        &description,
        &0u64, // no auto-claim
    );

    let escrow = escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, payment_escrow::EscrowStatus::Pending);
    assert_eq!(escrow.amount, deposit_amount);

    // Member balance: 100000 - 10000 (booking) - 5000 (escrow) = 85000
    assert_eq!(token.balance(&member), 85_000);

    // Admin completes the booking
    booking_client.complete_booking(&admin, &booking_id);
    let booking = booking_client.get_booking(&booking_id);
    assert_eq!(booking.status, workspace_booking::BookingStatus::Completed);

    // Admin releases escrow to operator
    escrow_client.release(&admin, &escrow_id);
    let escrow = escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, payment_escrow::EscrowStatus::Released);

    // Operator received the deposit
    assert_eq!(token.balance(&operator), 100_000 + 5000);
}

#[test]
fn test_booking_cancel_then_escrow_refund() {
    let (env, admin, member, operator) = create_test_env();
    let (token_address, token) = create_token(&env, &admin);

    let booking_client = setup_booking_contract(&env, &admin, &token_address);
    let escrow_client = setup_escrow_contract(&env, &admin, &token_address);

    let ws_id = register_workspace(&env, &booking_client, &admin);
    token.mint(&member, &100_000);

    env.ledger().with_mut(|l| l.timestamp = 1000);

    // Book workspace
    let booking_id = String::from_str(&env, "bk-002");
    booking_client.book_workspace(
        &member,
        &booking_id,
        &ws_id,
        &1000u64,
        &(1000 + 3600), // 1 hour
    );

    // Create security deposit escrow
    let escrow_id = String::from_str(&env, "esc-002");
    let deposit: i128 = 5000;
    let desc = String::from_str(&env, "Security deposit for bk-002");

    escrow_client.create_escrow(&member, &escrow_id, &operator, &deposit, &desc, &0u64);

    assert_eq!(token.balance(&member), 100_000 - 5000 - 5000);

    // Member cancels booking → refund booking payment
    booking_client.cancel_booking(&member, &booking_id);
    let booking = booking_client.get_booking(&booking_id);
    assert_eq!(booking.status, workspace_booking::BookingStatus::Cancelled);

    // Member got booking refund back (5000)
    assert_eq!(token.balance(&member), 100_000 - 5000);

    // Admin refunds escrow → member gets deposit back
    escrow_client.refund(&admin, &escrow_id);
    let escrow = escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, payment_escrow::EscrowStatus::Refunded);

    // Member fully refunded
    assert_eq!(token.balance(&member), 100_000);
}

#[test]
fn test_dispute_flow_on_escrow_after_booking() {
    let (env, admin, member, operator) = create_test_env();
    let (token_address, token) = create_token(&env, &admin);

    let booking_client = setup_booking_contract(&env, &admin, &token_address);
    let escrow_client = setup_escrow_contract(&env, &admin, &token_address);

    let ws_id = register_workspace(&env, &booking_client, &admin);
    token.mint(&member, &100_000);

    env.ledger().with_mut(|l| l.timestamp = 1000);

    // Book + create escrow
    let booking_id = String::from_str(&env, "bk-003");
    booking_client.book_workspace(
        &member,
        &booking_id,
        &ws_id,
        &1000u64,
        &(1000 + 7200), // 2 hours
    );

    let escrow_id = String::from_str(&env, "esc-003");
    let desc = String::from_str(&env, "Deposit for bk-003");
    escrow_client.create_escrow(
        &member,
        &escrow_id,
        &operator,
        &5000i128,
        &desc,
        &0u64,
    );

    // Advance time within dispute window (1 hour = 3600s)
    env.ledger().with_mut(|l| l.timestamp = 2000);

    // Member raises dispute
    escrow_client.raise_dispute(&member, &escrow_id);
    let escrow = escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, payment_escrow::EscrowStatus::Disputed);

    // Admin resolves in favor of member (refund)
    escrow_client.resolve_dispute(&admin, &escrow_id, &false);
    let escrow = escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, payment_escrow::EscrowStatus::Refunded);

    // Member got deposit back
    assert_eq!(token.balance(&member), 100_000 - 5000);

    // Admin completes the booking normally
    booking_client.complete_booking(&admin, &booking_id);
}

#[test]
fn test_auto_claim_escrow_after_booking_period() {
    let (env, admin, member, operator) = create_test_env();
    let (token_address, token) = create_token(&env, &admin);

    let booking_client = setup_booking_contract(&env, &admin, &token_address);
    let escrow_client = setup_escrow_contract(&env, &admin, &token_address);

    let ws_id = register_workspace(&env, &booking_client, &admin);
    token.mint(&member, &100_000);
    token.mint(&operator, &0);

    env.ledger().with_mut(|l| l.timestamp = 1000);

    // Book workspace
    let booking_id = String::from_str(&env, "bk-004");
    booking_client.book_workspace(
        &member,
        &booking_id,
        &ws_id,
        &1000u64,
        &(1000 + 3600),
    );

    // Create escrow with auto-claim after 7200 seconds (2 hours from now)
    let escrow_id = String::from_str(&env, "esc-004");
    let desc = String::from_str(&env, "Deposit for bk-004 with auto-claim");
    let release_after: u64 = 1000 + 7200; // 2 hours from creation
    escrow_client.create_escrow(
        &member,
        &escrow_id,
        &operator,
        &3000i128,
        &desc,
        &release_after,
    );

    // Complete the booking
    booking_client.complete_booking(&admin, &booking_id);

    // Advance time past release_after
    env.ledger().with_mut(|l| l.timestamp = 9000);

    // Operator (beneficiary) claims the escrow
    escrow_client.claim(&operator, &escrow_id);
    let escrow = escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, payment_escrow::EscrowStatus::Released);
    assert_eq!(token.balance(&operator), 3000);
}

#[test]
fn test_claim_too_early_fails() {
    let (env, admin, member, operator) = create_test_env();
    let (token_address, token) = create_token(&env, &admin);

    let booking_client = setup_booking_contract(&env, &admin, &token_address);
    let escrow_client = setup_escrow_contract(&env, &admin, &token_address);

    let ws_id = register_workspace(&env, &booking_client, &admin);
    token.mint(&member, &100_000);

    env.ledger().with_mut(|l| l.timestamp = 1000);

    // Create escrow with release_after far in the future
    let escrow_id = String::from_str(&env, "esc-005");
    let desc = String::from_str(&env, "Future deposit");
    escrow_client.create_escrow(
        &member,
        &escrow_id,
        &operator,
        &2000i128,
        &desc,
        &100_000u64, // release after timestamp 100000
    );

    // Try to claim immediately — should fail
    let result = escrow_client.try_claim(&operator, &escrow_id);
    assert!(result.is_err());
}

#[test]
fn test_dispute_after_window_fails() {
    let (env, admin, member, operator) = create_test_env();
    let (token_address, token) = create_token(&env, &admin);

    let booking_client = setup_booking_contract(&env, &admin, &token_address);
    let escrow_client = setup_escrow_contract(&env, &admin, &token_address);

    let ws_id = register_workspace(&env, &booking_client, &admin);
    token.mint(&member, &100_000);

    env.ledger().with_mut(|l| l.timestamp = 1000);

    let escrow_id = String::from_str(&env, "esc-006");
    let desc = String::from_str(&env, "Deposit for dispute test");
    escrow_client.create_escrow(
        &member,
        &escrow_id,
        &operator,
        &2000i128,
        &desc,
        &0u64,
    );

    // Advance past dispute window (1 hour)
    env.ledger().with_mut(|l| l.timestamp = 5000);

    // Try to dispute — should fail
    let result = escrow_client.try_raise_dispute(&member, &escrow_id);
    assert!(result.is_err());
}

#[test]
fn test_sequential_bookings_with_shared_escrow_pool() {
    let (env, admin, member1, member2) = create_test_env();
    let (token_address, token) = create_token(&env, &admin);

    let booking_client = setup_booking_contract(&env, &admin, &token_address);
    let escrow_client = setup_escrow_contract(&env, &admin, &token_address);

    let ws_id = register_workspace(&env, &booking_client, &admin);
    token.mint(&member1, &100_000);
    token.mint(&member2, &100_000);

    env.ledger().with_mut(|l| l.timestamp = 1000);

    // Member1 books slot 1
    let bk1 = String::from_str(&env, "bk-006");
    booking_client.book_workspace(&member1, &bk1, &ws_id, &1000u64, &(1000 + 3600));

    // Member2 cannot book overlapping slot
    let bk2 = String::from_str(&env, "bk-007");
    let result = booking_client.try_book_workspace(
        &member2,
        &bk2,
        &ws_id,
        &1800u64,
        &(1800 + 3600), // overlaps with member1's booking
    );
    assert!(result.is_err());

    // Member2 books non-overlapping slot
    let bk3 = String::from_str(&env, "bk-008");
    booking_client.book_workspace(
        &member2,
        &bk3,
        &ws_id,
        &(1000 + 3600),
        &(1000 + 7200), // starts after member1 ends
    );

    // Both create security deposits
    let esc1 = String::from_str(&env, "esc-007");
    let esc2 = String::from_str(&env, "esc-008");
    let desc1 = String::from_str(&env, "Deposit for bk-006");
    let desc2 = String::from_str(&env, "Deposit for bk-008");

    escrow_client.create_escrow(&member1, &esc1, &admin, &5000i128, &desc1, &0u64);
    escrow_client.create_escrow(&member2, &esc2, &admin, &5000i128, &desc2, &0u64);

    // Both bookings complete
    booking_client.complete_booking(&admin, &bk1);
    booking_client.complete_booking(&admin, &bk3);

    // Admin releases both escrows
    escrow_client.release(&admin, &esc1);
    escrow_client.release(&admin, &esc2);

    assert_eq!(token.balance(&admin), 10_000);
}
