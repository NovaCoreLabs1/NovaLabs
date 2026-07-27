// contracts/resource_credits/tests/bench.rs
//
// Gas-benchmark harness for the resource_credits contract (Issue #71).

#![cfg(test)]

use resource_credits::{ResourceCreditsContract, ResourceCreditsContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn emit_bench(method: &str, env: &Env, started_at: u64) {
    let estimate = env.cost_estimate();
    let cpu = estimate.cpu_insns.saturating_sub(started_at);
    let mem = estimate.mem_bytes;
    eprintln!("BENCH resource_credits::{method} cpu={cpu} mem={mem}");
}

#[test]
fn bench_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let payment = Address::generate(&env);
    let start = env.cost_estimate().cpu_insns;
    client.initialize(&admin, &payment);
    emit_bench("initialize", &env, start);
}

#[test]
fn bench_mint_credits() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let payment = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.initialize(&admin, &payment);
    let start = env.cost_estimate().cpu_insns;
    client.mint_credits(&admin, &recipient, &1_000u128);
    emit_bench("mint_credits", &env, start);
}

#[test]
fn bench_transfer_credits() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let payment = Address::generate(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    client.initialize(&admin, &payment);
    client.mint_credits(&admin, &from, &5_000u128);
    let start = env.cost_estimate().cpu_insns;
    client.transfer_credits(&from, &to, &1_500u128);
    emit_bench("transfer_credits", &env, start);
}

#[test]
fn bench_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ResourceCreditsContract, ());
    let client = ResourceCreditsContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let payment = Address::generate(&env);
    let member = Address::generate(&env);
    client.initialize(&admin, &payment);
    let start = env.cost_estimate().cpu_insns;
    let _ = client.balance(&member);
    emit_bench("balance", &env, start);
}
