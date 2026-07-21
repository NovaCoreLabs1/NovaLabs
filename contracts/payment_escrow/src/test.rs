// contracts/payment_escrow/src/test.rs

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISPUTE_WINDOW: u64 = 86_400;

fn setup_contract(env: &Env) -> Address {
    env.register(PaymentEscrowContract, ())
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

fn advance_time(env: &Env, seconds: u64) {
    env.ledger().with_mut(|l| l.timestamp += seconds);
}

fn init<'a>(
    env: &'a Env,
    contract_id: &Address,
    admin: &Address,
    token: &Address,
) -> PaymentEscrowContractClient<'a> {
    let client = PaymentEscrowContractClient::new(env, contract_id);
    client.initialize(admin, token, &DISPUTE_WINDOW);
    client
}

// ── Initialisation ────────────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    env.mock_all_auths();
    let client = init(&env, &contract_id, &admin, &token);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.payment_token(), token);
    assert_eq!(client.dispute_window(), DISPUTE_WINDOW);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    env.mock_all_auths();
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token, &DISPUTE_WINDOW);
    client.initialize(&admin, &token, &DISPUTE_WINDOW);
}

// ── Escrow creation ───────────────────────────────────────────────────────────

#[test]
fn test_create_escrow_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Security deposit – booking ws-001"),
        &0u64,
    );

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.beneficiary, beneficiary);
    assert_eq!(escrow.amount, 5_000i128);
    assert_eq!(escrow.status, EscrowStatus::Pending);
    assert_eq!(escrow.dispute_window, DISPUTE_WINDOW);
    assert_eq!(escrow.release_after, 0u64);

    assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 5_000);
    assert_eq!(TokenClient::new(&env, &token).balance(&depositor), 5_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_create_escrow_duplicate_id_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 20_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit A"),
        &0u64,
    );
    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit B"),
        &0u64,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_create_escrow_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &0i128,
        &String::from_str(&env, "Zero deposit"),
        &0u64,
    );
}

// ── Admin release / refund ────────────────────────────────────────────────────

#[test]
fn test_release_sends_funds_to_beneficiary() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.release(&admin, &String::from_str(&env, "esc-001"));

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 5_000);
    assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 0);

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Released);
    assert!(escrow.resolved_at.is_some());
}

#[test]
fn test_refund_returns_funds_to_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.refund(&admin, &String::from_str(&env, "esc-001"));

    assert_eq!(TokenClient::new(&env, &token).balance(&depositor), 10_000); // fully restored
    assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 0);

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_release_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Unauthorized = 2
    client.release(&depositor, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_release_already_released_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.release(&admin, &String::from_str(&env, "esc-001"));
    // EscrowNotPending = 6
    client.release(&admin, &String::from_str(&env, "esc-001"));
}

// ── Dispute flow ──────────────────────────────────────────────────────────────

#[test]
fn test_raise_dispute_within_window() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Advance by 1 hour — still within 24-hour window
    advance_time(&env, 3_600);
    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));

    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Disputed);
    assert!(escrow.dispute_raised_at.is_some());
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_raise_dispute_after_window_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Advance past the 24-hour window
    advance_time(&env, DISPUTE_WINDOW + 1);
    // DisputeWindowClosed = 8
    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_raise_dispute_when_window_zero_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    // Initialise with dispute window = 0 (disputes disabled)
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token, &0u64);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "No-dispute deposit"),
        &0u64,
    );

    // DisputeWindowClosed = 8 because window == 0
    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
}

#[test]
fn test_resolve_dispute_releases_to_beneficiary() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &true);

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 5_000);
    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
fn test_resolve_dispute_refunds_to_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &false);

    assert_eq!(TokenClient::new(&env, &token).balance(&depositor), 10_000); // full refund
    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_resolve_dispute_on_pending_escrow_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // EscrowNotDisputed = 7 — escrow is still Pending, no dispute raised
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &true);
}

// ── Auto-claim ────────────────────────────────────────────────────────────────

#[test]
fn test_claim_after_release_time_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let now = env.ledger().timestamp();
    let release_after = now + 3_600; // 1 hour from now

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Time-locked payment"),
        &release_after,
    );

    // Advance past release_after
    advance_time(&env, 3_601);
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));

    assert_eq!(TokenClient::new(&env, &token).balance(&beneficiary), 5_000);
    let escrow = client.get_escrow(&String::from_str(&env, "esc-001"));
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_claim_before_release_time_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let now = env.ledger().timestamp();
    let release_after = now + 3_600;

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Time-locked payment"),
        &release_after,
    );

    // ClaimTooEarly = 9 — not enough time has passed
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_claim_when_auto_claim_disabled_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    // release_after = 0 disables auto-claim
    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Admin-only deposit"),
        &0u64,
    );

    // AutoClaimDisabled = 10
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));
}

// ── Indexes ───────────────────────────────────────────────────────────────────

#[test]
fn test_depositor_and_beneficiary_indexes() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 50_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    for i in 0u32..3 {
        let id = match i {
            0 => String::from_str(&env, "esc-001"),
            1 => String::from_str(&env, "esc-002"),
            _ => String::from_str(&env, "esc-003"),
        };
        client.create_escrow(
            &depositor,
            &id,
            &beneficiary,
            &1_000i128,
            &String::from_str(&env, "Deposit"),
            &0u64,
        );
    }

    assert_eq!(client.get_depositor_escrows(&depositor).len(), 3u32);
    assert_eq!(client.get_beneficiary_escrows(&beneficiary).len(), 3u32);
}

// ── Dispute window update ─────────────────────────────────────────────────────

#[test]
fn test_set_dispute_window_applies_to_new_escrows() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 20_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    // Change window to 48 hours
    client.set_dispute_window(&admin, &172_800u64);
    assert_eq!(client.dispute_window(), 172_800u64);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-002"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    let escrow = client.get_escrow(&String::from_str(&env, "esc-002"));
    // New escrow picks up the updated window
    assert_eq!(escrow.dispute_window, 172_800u64);
}

// ── Negative-path tests (Issue #68) ───────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_get_escrow_not_found_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.get_escrow(&String::from_str(&env, "nonexistent"));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_release_escrow_not_found_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.release(&admin, &String::from_str(&env, "nonexistent"));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_refund_escrow_not_found_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.refund(&admin, &String::from_str(&env, "nonexistent"));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_raise_dispute_escrow_not_found_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.raise_dispute(&depositor, &String::from_str(&env, "nonexistent"));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_claim_escrow_not_found_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.claim(&beneficiary, &String::from_str(&env, "nonexistent"));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_refund_already_released_escrow_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.release(&admin, &String::from_str(&env, "esc-001"));
    // EscrowNotPending = 6
    client.refund(&admin, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_release_already_refunded_escrow_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.refund(&admin, &String::from_str(&env, "esc-001"));
    // EscrowNotPending = 6
    client.release(&admin, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_claim_already_released_escrow_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let now = env.ledger().timestamp();
    let release_after = now + 3_600;

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Time-locked"),
        &release_after,
    );

    advance_time(&env, 3_601);
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));
    // EscrowNotPending = 6
    client.claim(&beneficiary, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_raise_dispute_non_depositor_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let other = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    // Unauthorized = 2 — only depositor can raise dispute
    client.raise_dispute(&other, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_claim_non_beneficiary_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let other = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    let now = env.ledger().timestamp();
    let release_after = now + 3_600;

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Time-locked"),
        &release_after,
    );

    advance_time(&env, 3_601);
    // Unauthorized = 2 — only beneficiary can claim
    client.claim(&other, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_raise_dispute_on_already_disputed_escrow_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
    // EscrowNotPending = 6
    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_resolve_dispute_on_already_resolved_escrow_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &true);
    // EscrowNotDisputed = 7
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &false);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_create_escrow_negative_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &-1i128,
        &String::from_str(&env, "Negative deposit"),
        &0u64,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_release_without_init_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let _token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = PaymentEscrowContractClient::new(&env, &contract_id);

    // No initialize — AdminNotSet = 1
    client.release(&admin, &String::from_str(&env, "anything"));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_set_dispute_window_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    // Unauthorized = 2
    client.set_dispute_window(&non_admin, &86_400u64);
}

#[test]
fn test_depositor_and_beneficiary_indexes_after_release() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    assert_eq!(client.get_depositor_escrows(&depositor).len(), 1u32);
    assert_eq!(client.get_beneficiary_escrows(&beneficiary).len(), 1u32);

    client.release(&admin, &String::from_str(&env, "esc-001"));

    // Indexes persist after resolution
    assert_eq!(client.get_depositor_escrows(&depositor).len(), 1u32);
    assert_eq!(client.get_beneficiary_escrows(&beneficiary).len(), 1u32);
}

#[test]
fn test_refund_after_dispute_returns_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let token = setup_token(&env, &admin, &depositor, 10_000);

    let contract_id = setup_contract(&env);
    let client = init(&env, &contract_id, &admin, &token);

    client.create_escrow(
        &depositor,
        &String::from_str(&env, "esc-001"),
        &beneficiary,
        &5_000i128,
        &String::from_str(&env, "Deposit"),
        &0u64,
    );

    client.raise_dispute(&depositor, &String::from_str(&env, "esc-001"));
    client.resolve_dispute(&admin, &String::from_str(&env, "esc-001"), &false);

    assert_eq!(TokenClient::new(&env, &token).balance(&depositor), 10_000);
    assert_eq!(TokenClient::new(&env, &token).balance(&contract_id), 0);
}
