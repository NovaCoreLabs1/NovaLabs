#!/usr/bin/env python3
# scripts/bench_contracts.py
#
# Issue #71 — Gas benchmarks across contracts in CI.
#
# Usage:
#   python3 scripts/bench_contracts.py [baseline-dir]
#
# What it does:
#   1. Runs `cargo test --release --test bench -- --nocapture` for every
#      contract in contracts/ that has a `tests/bench.rs` integration test.
#   2. Parses BENCH lines from stderr (one per method).
#   3. Compares each measurement against contracts/<name>/benches/baseline.json.
#   4. Fails (exit 1) if any CPU or memory cost regressed >20% vs the baseline.
#
# Why this design:
#   - Soroban benches on stable Rust: cargo `[[bench]]` blocks need nightly for
#     criterion-style setup; integration tests under `tests/` run on stable
#     with no extra configuration.
#   - `env.cost_estimate()` is available in soroban-sdk testutils, so the
#     bench files just call it before and after the work.
#   - The Python script is portable, has no Rust nightly requirement, and
#     is easy to maintain from CI logs.

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_DIR = REPO_ROOT / "contracts"

# Pattern: BENCH <contract>::<method> cpu=<int> mem=<int>
BENCH_RE = re.compile(
    r"^BENCH (?P<contract>[a-zA-Z0-9_]+)::(?P<method>[a-zA-Z0-9_]+) "
    r"cpu=(?P<cpu>\d+) mem=(?P<mem>\d+)\b"
)

DEFAULT_TOLERANCE_PCT = 20


def run_benches(verbose: bool = False) -> Dict[str, Dict[str, Dict[str, int]]]:
    """Run cargo test --release for every contracts/*/tests/bench.rs and
    capture BENCH lines. Returns: contract -> method -> {cpu, mem}."""
    benches_dir = CONTRACTS_DIR
    findings: Dict[str, Dict[str, Dict[str, int]]] = {}
    found_any = False

    for crate in sorted(benches_dir.iterdir()):
        bench_path = crate / "tests" / "bench.rs"
        if not bench_path.exists():
            continue
        found_any = True
        if verbose:
            print(f"-- running benches for {crate.name}", file=sys.stderr)

        proc = subprocess.run(
            [
                "cargo",
                "test",
                "--release",
                "-p",
                crate.name,
                "--test",
                "bench",
                "--",
                "--nocapture",
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=900,
        )
        if verbose:
            print(f"   cargo exit: {proc.returncode}", file=sys.stderr)

        for line in proc.stderr.splitlines():
            match = BENCH_RE.match(line.strip())
            if not match:
                continue
            contract = match.group("contract")
            method = match.group("method")
            cpu = int(match.group("cpu"))
            mem = int(match.group("mem"))
            findings.setdefault(contract, {})[method] = {"cpu": cpu, "mem": mem}

    if not found_any:
        print(
            "no contracts/benches found; nothing to compare",
            file=sys.stderr,
        )
    return findings


def load_baselines() -> Dict[str, dict]:
    """Load every contracts/*/benches/baseline.json file."""
    baselines: Dict[str, dict] = {}
    for crate in sorted(CONTRACTS_DIR.iterdir()):
        baseline_path = crate / "benches" / "baseline.json"
        if not baseline_path.exists():
            continue
        try:
            baselines[crate.name] = json.loads(baseline_path.read_text())
        except Exception as exc:
            print(
                f"warning: failed to parse {baseline_path}: {exc}",
                file=sys.stderr,
            )
    return baselines


def compare(
    findings: Dict[str, Dict[str, Dict[str, int]]],
    baselines: Dict[str, dict],
) -> Tuple[bool, list]:
    failures: list = []
    for contract, methods in findings.items():
        bl_contract = baselines.get(contract)
        if not bl_contract:
            print(
                f"note: no baseline for {contract}; skipping comparison",
                file=sys.stderr,
            )
            continue
        tol = bl_contract.get("tolerance_pct", DEFAULT_TOLERANCE_PCT)
        for method, measurement in methods.items():
            baseline = bl_contract.get("measurements", {}).get(method)
            if not baseline:
                print(
                    f"note: no baseline entry for {contract}::{method}; new measurement only",
                    file=sys.stderr,
                )
                continue
            bl_cpu = baseline.get("cpu")
            bl_mem = baseline.get("mem")
            new_cpu = measurement["cpu"]
            new_mem = measurement["mem"]
            if bl_cpu:
                ratio = new_cpu / bl_cpu
                if ratio > 1 + (tol / 100):
                    failures.append(
                        f"REGRESSION {contract}::{method} cpu: baseline {bl_cpu} → "
                        f"measured {new_cpu} ({(ratio - 1) * 100:.1f}% > {tol}%)"
                    )
            if bl_mem:
                ratio = new_mem / bl_mem
                if ratio > 1 + (tol / 100):
                    failures.append(
                        f"REGRESSION {contract}::{method} mem: baseline {bl_mem} → "
                        f"measured {new_mem} ({(ratio - 1) * 100:.1f}% > {tol}%)"
                    )
    return (len(failures) == 0), failures


def main() -> int:
    verbose = os.environ.get("BENCH_VERBOSE") == "1"
    findings = run_benches(verbose=verbose)
    if not findings:
        return 0
    baselines = load_baselines()
    ok, failures = compare(findings, baselines)
    if failures:
        print("Gas benchmark regressions detected:")
        for line in failures:
            print(f"  - {line}")
        return 1
    print("Gas benchmarks within tolerance ({}%).".format(DEFAULT_TOLERANCE_PCT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
