// contracts/resource_credits/src/test.rs

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup_contract(env: &Env) -> Address {
    env.register(ResourceCreditsContract, ())
}

fn setup_with_admin(env: &Env) -> (Address, Address, Address) {
    let contract_id = setup_contract(env);
    let admin = Address::generate(env);
    let payment_token = Address::generate(env);
    let client = ResourceCreditsContractClient::new(env, &contract_id);
    env.mock_all_auths();
    client.initialize(&admin, &payment_token);
    (contract_id, admin, payment_token)
}

// ── Initialization tests ─────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    env.mock_all_auths();
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token);

    assert_eq!(client.total_supply(), 0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let admin = Address::generate(&env);
    let token = Address::generate(&env);

    env.mock_all_auths();
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token);
    client.initialize(&admin, &token);
}

// ── Mint tests ───────────────────────────────────────────────────────────────

#[test]
fn test_mint_credits_success() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let recipient = Address::generate(&env);

    client.mint_credits(&admin, &recipient, &1000u128);

    assert_eq!(client.balance(&recipient), 1000u128);
    assert_eq!(client.total_supply(), 1000u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_mint_zero_amount_fails() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let recipient = Address::generate(&env);

    client.mint_credits(&admin, &recipient, &0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_mint_non_admin_fails() {
    let env = Env::default();
    let (contract_id, _admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let non_admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint_credits(&non_admin, &recipient, &1000u128);
}

#[test]
fn test_mint_to_multiple_recipients() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    client.mint_credits(&admin, &r1, &500u128);
    client.mint_credits(&admin, &r2, &300u128);

    assert_eq!(client.balance(&r1), 500u128);
    assert_eq!(client.balance(&r2), 300u128);
    assert_eq!(client.total_supply(), 800u128);
}

// ── Transfer tests ───────────────────────────────────────────────────────────

#[test]
fn test_transfer_credits_success() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint_credits(&admin, &alice, &1000u128);
    client.transfer_credits(&alice, &bob, &400u128);

    assert_eq!(client.balance(&alice), 600u128);
    assert_eq!(client.balance(&bob), 400u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_transfer_zero_amount_fails() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint_credits(&admin, &alice, &1000u128);
    client.transfer_credits(&alice, &bob, &0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_transfer_insufficient_balance_fails() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint_credits(&admin, &alice, &100u128);
    client.transfer_credits(&alice, &bob, &200u128);
}

#[test]
fn test_transfer_exact_balance_succeeds() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint_credits(&admin, &alice, &500u128);
    client.transfer_credits(&alice, &bob, &500u128);

    assert_eq!(client.balance(&alice), 0u128);
    assert_eq!(client.balance(&bob), 500u128);
}

#[test]
fn test_transfer_to_self_succeeds() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let alice = Address::generate(&env);

    client.mint_credits(&admin, &alice, &500u128);
    client.transfer_credits(&alice, &alice, &200u128);

    assert_eq!(client.balance(&alice), 500u128);
}

// ── Spend (burn) tests ───────────────────────────────────────────────────────

#[test]
fn test_spend_credits_success() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    client.mint_credits(&admin, &member, &1000u128);
    client.spend_credits(&member, &300u128);

    assert_eq!(client.balance(&member), 700u128);
    assert_eq!(client.total_supply(), 700u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_spend_zero_amount_fails() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    client.mint_credits(&admin, &member, &1000u128);
    client.spend_credits(&member, &0u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_spend_insufficient_balance_fails() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    client.mint_credits(&admin, &member, &100u128);
    client.spend_credits(&member, &500u128);
}

#[test]
fn test_spend_exact_balance_succeeds() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    client.mint_credits(&admin, &member, &500u128);
    client.spend_credits(&member, &500u128);

    assert_eq!(client.balance(&member), 0u128);
    assert_eq!(client.total_supply(), 0u128);
}

// ── Edge case tests ──────────────────────────────────────────────────────────

#[test]
fn test_balance_of_nonexistent_account_returns_zero() {
    let env = Env::default();
    let (contract_id, _admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let unknown = Address::generate(&env);

    assert_eq!(client.balance(&unknown), 0u128);
}

#[test]
fn test_total_supply_initially_zero() {
    let env = Env::default();
    let (contract_id, _admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);

    assert_eq!(client.total_supply(), 0u128);
}

#[test]
fn test_mint_increases_total_supply() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    client.mint_credits(&admin, &r1, &100u128);
    assert_eq!(client.total_supply(), 100u128);

    client.mint_credits(&admin, &r2, &200u128);
    assert_eq!(client.total_supply(), 300u128);
}

#[test]
fn test_spend_decreases_total_supply() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let member = Address::generate(&env);

    client.mint_credits(&admin, &member, &500u128);
    assert_eq!(client.total_supply(), 500u128);

    client.spend_credits(&member, &200u128);
    assert_eq!(client.total_supply(), 300u128);
}

#[test]
fn test_transfer_does_not_affect_total_supply() {
    let env = Env::default();
    let (contract_id, admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint_credits(&admin, &alice, &1000u128);
    let supply_before = client.total_supply();

    client.transfer_credits(&alice, &bob, &400u128);

    assert_eq!(client.total_supply(), supply_before);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_mint_without_initialize_fails() {
    let env = Env::default();
    let contract_id = setup_contract(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.mock_all_auths();
    client.mint_credits(&admin, &recipient, &100u128);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_transfer_from_zero_balance_fails() {
    let env = Env::default();
    let (contract_id, _admin, _token) = setup_with_admin(&env);
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    // Alice has no credits
    client.transfer_credits(&alice, &bob, &1u128);
}
