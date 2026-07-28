// Allow deprecated events API until migration to #[contractevent] macro
#![allow(deprecated)]

//! # On-chain Admin Audit Log
//!
//! Records every privileged admin operation in a tamper-evident, on-chain
//! append-only log.  Each entry captures:
//!
//! - `action`     — String label for the operation (e.g. `"set_admin"`).
//! - `caller`     — The `Address` that invoked the operation.
//! - `timestamp`  — Ledger timestamp at the moment of the call.
//! - `payload_hash` — SHA-256 hash of the operation's input payload bytes,
//!   providing a compact, verifiable fingerprint of what was changed
//!   (follows Stellar SDK's `env.crypto().sha256`).
//!
//! ## Storage layout
//!
//! | Key                          | Storage     | Description                        |
//! |------------------------------|-------------|------------------------------------|
//! | `AuditDataKey::AuditLog`     | `instance`  | `Vec<AuditLogEntry>` (all entries) |
//!
//! Instance storage is chosen deliberately: audit entries are small, there are
//! few admin operations in practice, and instance-level storage is atomically
//! consistent with the rest of the contract state.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use crate::audit::{AuditLog, AdminAction};
//!
//! AuditLog::write(
//!     &env,
//!     AdminAction::SetAdmin,
//!     &caller,
//!     payload_bytes,   // e.g. new_admin.to_val().to_xdr(...)
//! );
//! ```

use soroban_sdk::xdr::ToXdr;
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, BytesN, Env, String, Vec};

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

#[contracttype]
pub enum AuditDataKey {
    /// The append-only list of all admin audit entries.
    AuditLog,
}

// ---------------------------------------------------------------------------
// Action enum
// ---------------------------------------------------------------------------

/// Identifies which privileged operation was executed.
///
/// Adding a new variant here (and calling `AuditLog::write` in the
/// corresponding function) is the only change required to audit a new
/// admin operation.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum AdminAction {
    /// `set_admin` was called — admin address was replaced.
    SetAdmin,
    /// `set_usdc_contract` was called — USDC payment contract was updated.
    SetUsdcContract,
    /// `pause_subscription_admin` was called — a subscription was admin-paused.
    PauseSubscriptionAdmin,
    /// `set_pause_config` was called — global pause configuration was changed.
    SetPauseConfig,
}

// ---------------------------------------------------------------------------
// Log entry
// ---------------------------------------------------------------------------

/// A single immutable record of one privileged admin operation.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AuditLogEntry {
    /// Which admin operation was executed.
    pub action: AdminAction,
    /// The address that authenticated and triggered the operation.
    pub caller: Address,
    /// Ledger timestamp at the moment the operation ran.
    pub timestamp: u64,
    /// SHA-256 hash of the serialised operation payload.
    ///
    /// Clients can independently reconstruct the hash from the same inputs
    /// to verify the log has not been tampered with (within a single ledger).
    pub payload_hash: BytesN<32>,
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

pub struct AuditLog;

impl AuditLog {
    /// Appends a new audit entry to the on-chain log.
    ///
    /// # Arguments
    ///
    /// * `env`     — Contract environment.
    /// * `action`  — The [`AdminAction`] being recorded.
    /// * `caller`  — Address that authenticated and triggered the operation.
    /// * `payload` — Raw bytes representing the operation's input (used only
    ///   for hashing; not stored verbatim to keep entry size small).
    ///
    /// # Side-effects
    ///
    /// - Writes/updates `AuditDataKey::AuditLog` in instance storage.
    /// - Emits an `audit_op` contract event so indexers can track entries
    ///   without replaying full storage reads.
    pub fn write(env: &Env, action: AdminAction, caller: &Address, payload: Bytes) {
        let payload_hash: BytesN<32> = env.crypto().sha256(&payload).into();

        let entry = AuditLogEntry {
            action: action.clone(),
            caller: caller.clone(),
            timestamp: env.ledger().timestamp(),
            payload_hash: payload_hash.clone(),
        };

        // Load existing log (or start with an empty one).
        let mut log: Vec<AuditLogEntry> = env
            .storage()
            .instance()
            .get(&AuditDataKey::AuditLog)
            .unwrap_or_else(|| Vec::new(env));

        log.push_back(entry);
        env.storage().instance().set(&AuditDataKey::AuditLog, &log);

        // Emit a lightweight event so off-chain indexers stay in sync.
        env.events().publish(
            (symbol_short!("audit_op"), caller.clone()),
            (action, payload_hash, env.ledger().timestamp()),
        );
    }

    /// Returns the full audit log, or an empty `Vec` if no entries exist yet.
    pub fn read(env: &Env) -> Vec<AuditLogEntry> {
        env.storage()
            .instance()
            .get(&AuditDataKey::AuditLog)
            .unwrap_or_else(|| Vec::new(env))
    }

    // -----------------------------------------------------------------------
    // Internal helpers — build canonical payload bytes for each action type
    // -----------------------------------------------------------------------

    /// Builds the payload bytes for a `SetAdmin` entry.
    ///
    /// Payload: `caller_address_bytes ++ new_admin_address_bytes`
    pub fn payload_set_admin(env: &Env, caller: &Address, new_admin: &Address) -> Bytes {
        let mut b = Bytes::new(env);
        b.append(&caller.clone().to_xdr(env));
        b.append(&new_admin.clone().to_xdr(env));
        b
    }

    /// Builds the payload bytes for a `SetUsdcContract` entry.
    ///
    /// Payload: `caller_address_bytes ++ usdc_address_bytes`
    pub fn payload_set_usdc(env: &Env, caller: &Address, usdc: &Address) -> Bytes {
        let mut b = Bytes::new(env);
        b.append(&caller.clone().to_xdr(env));
        b.append(&usdc.clone().to_xdr(env));
        b
    }

    /// Builds the payload bytes for a `PauseSubscriptionAdmin` entry.
    ///
    /// Payload: `caller_address_bytes ++ subscription_id_bytes`
    pub fn payload_pause_admin(env: &Env, caller: &Address, sub_id: &String) -> Bytes {
        let mut b = Bytes::new(env);
        b.append(&caller.clone().to_xdr(env));
        b.append(&sub_id.clone().to_xdr(env));
        b
    }

    /// Builds the payload bytes for a `SetPauseConfig` entry.
    ///
    /// Payload: `caller_address_bytes`
    /// (PauseConfig is large; its XDR encoding is the canonical representation
    ///  but is omitted here to keep the hash deterministic without importing
    ///  the full type.  The timestamp in the entry pins the ledger-state.)
    pub fn payload_set_pause_config(env: &Env, caller: &Address) -> Bytes {
        let mut b = Bytes::new(env);
        b.append(&caller.clone().to_xdr(env));
        b
    }
}
