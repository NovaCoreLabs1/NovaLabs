//! # Reentrancy Guard Middleware
//!
//! Provides a reusable guard that prevents reentrancy across cross-contract
//! calls. Any state-changing function that performs a token transfer (or any
//! other cross-contract interaction) must acquire the guard *before* making the
//! external call. The guard sets an instance-storage lock; if the same function
//! is re-entered through a malicious callback while the lock is held, the
//! second call reverts instead of mutating state a second time.
//!
//! | Guard                     | Error returned                  |
//! |---------------------------|---------------------------------|
//! | `Guard::reentrancy_protect` | `Error::ReentrancyLock`      |
//!
//! ## Lock storage
//!
//! The lock is written to [`soroban_sdk::Env::storage`] instance storage under a
//! caller-supplied [`ReentrancyKey`]. Instance storage lives for the lifetime
//! of the contract (see [Soroban state archival](https://docs.soroban.stellar.org/docs/fundamentals-and-concepts/state-archival#temporary-storage))
//! and is cheap to read/write, which keeps the guard overhead minimal. The lock
//! is set to `true` for the duration of the guarded call and cleared on exit.
//!
//! ## Usage
//!
//! ```rust,ignore
//! // At the very top of any function that transfers tokens or calls another
//! // contract:
//! let _guard = Guard::reentrancy_protect(&env, &ReentrancyKey::Create)?;
//!
//! // ... now perform the cross-contract transfer safely ...
//!
//! // The lock is released automatically when `_guard` is dropped at the end of
//! // the function scope.
//! ```
//!
//! The returned [`ReentrancyGuard`] releases the lock via its `Drop` impl, so a
//! function that acquires the guard is protected even on early `return`/`?`
//! paths.

use crate::errors::Error;
use soroban_sdk::{Env, Symbol};

/// Storage keys used to lock individual reentrant entry points.
///
/// Each logical state-changing operation gets its own key so that unrelated
/// operations never block one another, while a re-entrant call to the *same*
/// operation is always rejected.
#[derive(Clone)]
pub enum ReentrancyKey {
    /// `create_escrow` reentrancy lock.
    Create,
    /// `release` reentrancy lock.
    Release,
    /// `refund` reentrancy lock.
    Refund,
    /// `resolve_dispute` reentrancy lock.
    Resolve,
    /// `claim` reentrancy lock.
    Claim,
}

/// Acquires the reentrancy lock for the given key and returns a guard that
/// releases it on drop.
///
/// Returns `Err(Error::ReentrancyLock)` if the lock is already held, which
/// means the entry point is being re-entered — the canonical reentrancy
/// vulnerability class. Callers should invoke this at the top of any function
/// that makes a cross-contract call (e.g. `token::Client::transfer`).
pub fn reentrancy_protect(env: &Env, key: &ReentrancyKey) -> Result<ReentrancyGuard, Error> {
    let lock_key = lock_symbol(env, key);
    if env.storage().instance().has(&lock_key) {
        return Err(Error::ReentrancyLock);
    }
    // Acquire the lock before any external interaction.
    env.storage().instance().set(&lock_key, &true);
    Ok(ReentrancyGuard {
        env: env.clone(),
        key: lock_key,
    })
}

/// Maps a logical [`ReentrancyKey`] to a compact instance-storage symbol.
fn lock_symbol(env: &Env, key: &ReentrancyKey) -> Symbol {
    match key {
        ReentrancyKey::Create => Symbol::new(env, "lock_create"),
        ReentrancyKey::Release => Symbol::new(env, "lock_release"),
        ReentrancyKey::Refund => Symbol::new(env, "lock_refund"),
        ReentrancyKey::Resolve => Symbol::new(env, "lock_resolve"),
        ReentrancyKey::Claim => Symbol::new(env, "lock_claim"),
    }
}

/// RAII guard that releases the reentrancy lock when dropped.
pub struct ReentrancyGuard {
    env: Env,
    key: Symbol,
}

impl Drop for ReentrancyGuard {
    fn drop(&mut self) {
        // Release the lock so the entry point can be called again after this
        // execution frame completes.
        self.env.storage().instance().remove(&self.key);
    }
}
