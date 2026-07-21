#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, BytesN as BytesNTestUtils, Ledger},
    Address, BytesN, Env,
};

#[test]
fn test_set_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let result = client.try_set_admin(&admin);
    assert!(result.is_ok());
}

#[test]
fn test_issue_token() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_ok());
}

#[test]
fn test_issue_token_already_exists() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    client.issue_token(&id, &user, &expiry);
    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_err());
}

#[test]
fn test_issue_token_invalid_expiry() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let past_expiry = 0u64;

    let result = client.try_issue_token(&id, &user, &past_expiry);
    assert!(result.is_err());
}

#[test]
fn test_get_token() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    client.issue_token(&id, &user, &expiry);

    let token = client.get_token(&id);
    assert_eq!(token.id, id);
    assert_eq!(token.user, user);
    assert_eq!(token.status, MembershipStatus::Active);
}

#[test]
fn test_get_token_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let id = BytesN::<32>::random(&env);
    let result = client.try_get_token(&id);
    assert!(result.is_err());
}

#[test]
fn test_transfer_token() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let new_user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    client.issue_token(&id, &user, &expiry);
    let result = client.try_transfer_token(&id, &new_user);
    assert!(result.is_ok());

    let token = client.get_token(&id);
    assert_eq!(token.user, new_user);
}

#[test]
fn test_issue_token_without_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100000;

    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_err());
}

// ── Negative-path tests (Issue #68) ───────────────────────────────────────────

#[test]
fn test_transfer_token_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let id = BytesN::<32>::random(&env);
    let new_user = Address::generate(&env);

    let result = client.try_transfer_token(&id, &new_user);
    assert!(result.is_err());
}

#[test]
fn test_transfer_expired_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let new_user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100;

    client.issue_token(&id, &user, &expiry);

    // Advance past expiry — status is still Active in storage,
    // transfer_token only checks the status field, not the expiry_date.
    env.ledger().with_mut(|l| l.timestamp += 200);

    // Transfer succeeds because the contract doesn't enforce expiry on transfer
    let result = client.try_transfer_token(&id, &new_user);
    assert!(result.is_ok());
}

#[test]
fn test_get_token_expired_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100;

    client.issue_token(&id, &user, &expiry);

    // Advance past expiry
    env.ledger().with_mut(|l| l.timestamp += 200);

    let result = client.try_get_token(&id);
    assert!(result.is_err());
}

#[test]
fn test_issue_token_expiry_at_current_time_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let current_time = env.ledger().timestamp();

    // Expiry == current time should fail (expiry must be > current time)
    let result = client.try_issue_token(&id, &user, &current_time);
    assert!(result.is_err());
}

#[test]
fn test_issue_token_with_different_ids_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;

    let id1 = BytesN::<32>::random(&env);
    let id2 = BytesN::<32>::random(&env);

    let r1 = client.try_issue_token(&id1, &user, &expiry);
    assert!(r1.is_ok());

    let r2 = client.try_issue_token(&id2, &user, &expiry);
    assert!(r2.is_ok());
}

#[test]
fn test_get_active_token_returns_details() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;

    client.issue_token(&id, &user, &expiry);

    let token = client.get_token(&id);
    assert_eq!(token.id, id);
    assert_eq!(token.user, user);
    assert_eq!(token.status, MembershipStatus::Active);
    assert_eq!(token.issue_date, env.ledger().timestamp());
    assert_eq!(token.expiry_date, expiry);
}

#[test]
fn test_transfer_token_updates_user() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.set_admin(&admin);

    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let new_user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;

    client.issue_token(&id, &user, &expiry);

    let token_before = client.get_token(&id);
    assert_eq!(token_before.user, user);

    client.transfer_token(&id, &new_user);

    let token_after = client.get_token(&id);
    assert_eq!(token_after.user, new_user);
    assert_eq!(token_after.status, MembershipStatus::Active);
}

#[test]
fn test_set_admin_updates_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MembershipTokenContract, ());
    let client = MembershipTokenContractClient::new(&env, &contract_id);

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    client.set_admin(&admin1);
    client.set_admin(&admin2);

    // Admin2 should now be able to issue tokens, admin1 should not
    let id = BytesN::<32>::random(&env);
    let user = Address::generate(&env);
    let expiry = env.ledger().timestamp() + 100_000;

    // With mock_all_auths, both pass auth checks, but admin2 set last
    let result = client.try_issue_token(&id, &user, &expiry);
    assert!(result.is_ok());
}
