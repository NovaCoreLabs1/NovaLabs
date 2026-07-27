// contracts/payment_escrow/tests/bench.rs
//
// Gas-benchmark harness for the payment_escrow contract (Issue #71).

#![cfg(test)]

use payment_escrow::{PaymentEscrowContract, PaymentEscrowContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn emit_bench(method: &str, env: &Env, started_at: u64) {
    let estimate = env.cost_estimate();
    let cpu = estimate.cpu_insns.saturating_sub(started_at);
    let mem = estimate.mem_bytes;
    eprintln!("BENCH payment_escrow::{method} cpu={cpu} mem={mem}");
}

#[test]
fn bench_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentEscrowContract, ());
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let payment = Address::generate(&env);
    let start = env.cost_estimate().cpu_insns;
    client.initialize(&admin, &payment, &3600u64);
    emit_bench("initialize", &env, start);
}

#[test]
fn bench_set_dispute_window() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentEscrowContract, ());
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let payment = Address::generate(&env);
    client.initialize(&admin, &payment, &3600u64);
    let start = env.cost_estimate().cpu_insns;
    client.set_dispute_window(&admin, &7_200u64);
    emit_bench("set_dispute_window", &env, start);
}

#[test]
fn bench_get_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentEscrowContract, ());
    let client = PaymentEscrowContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let payment = Address::generate(&env);
    client.initialize(&admin, &payment, &3600u64);
    let escrow_id = String::from_str(&env, "bench-escrow-1");
    let start = env.cost_estimate().cpu_insns;
    let _ = client.try_get_escrow(&escrow_id);
    emit_bench("get_escrow", &env, start);
}
