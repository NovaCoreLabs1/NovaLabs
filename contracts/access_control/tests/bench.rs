// contracts/access_control/tests/bench.rs
//
// Gas-benchmark harness for the access_control contract (Issue #71).

#![cfg(test)]

use access_control::{AccessControl, AccessControlClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn emit_bench(method: &str, env: &Env, started_at: u64) {
    let estimate = env.cost_estimate();
    let cpu = estimate.cpu_insns.saturating_sub(started_at);
    let mem = estimate.mem_bytes;
    eprintln!("BENCH access_control::{method} cpu={cpu} mem={mem}");
}

#[test]
fn bench_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let start = env.cost_estimate().cpu_insns;
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    emit_bench("initialize", &env, start);
}

#[test]
fn bench_set_role() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    client.initialize(&admin);
    let start = env.cost_estimate().cpu_insns;
    client.set_role(&admin, &user, &access_control::UserRole::Member);
    emit_bench("set_role", &env, start);
}

#[test]
fn bench_check_access() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let start = env.cost_estimate().cpu_insns;
    client.check_access(&admin, &access_control::UserRole::Admin);
    emit_bench("check_access", &env, start);
}

#[test]
fn bench_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let start = env.cost_estimate().cpu_insns;
    client.pause(&admin);
    emit_bench("pause", &env, start);
}

// Bench harness complete; the String import was unused so it was removed.
