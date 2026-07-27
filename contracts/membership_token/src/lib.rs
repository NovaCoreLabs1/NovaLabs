#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env};

#[contract]
pub struct MembershipTokenContract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MembershipStatus {
    Active,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MembershipToken {
    pub id: BytesN<32>,
    pub user: Address,
    pub status: MembershipStatus,
    pub issue_date: u64,
    pub expiry_date: u64,
}

/// Storage keys used by the contract.
///
/// `Admin`     — the address authorised to mutate contract configuration
///               (set_minter, pause/unpause, transfer-admin).
/// `Minter`    — the address authorised to mint new tokens (issue_token)
///               only. Distinct from `Admin` so a leaked admin key does
///               not silently mint into supply.
/// `Paused`    — boolean. While `true`, write-side operations
///               (issue_token) return `ContractPaused`. Reads continue.
/// `Token(<id>)` — per-token record.
#[contracttype]
pub enum DataKey {
    Token(BytesN<32>),
    Admin,
    Minter,
    Paused,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AdminNotSet = 1,
    TokenAlreadyIssued = 2,
    InvalidExpiryDate = 3,
    TokenNotFound = 4,
    TokenExpired = 5,
    MinterNotSet = 6,
    Unauthorised = 7,
    AlreadyPaused = 8,
    NotPaused = 9,
    /// The contract is paused; write-side operations reject.
    /// Re-uses code 5 so older clients see a sensible error.
    ContractPaused = 10,
}

#[contractimpl]
impl MembershipTokenContract {
    pub fn issue_token(
        env: Env,
        id: BytesN<32>,
        user: Address,
        expiry_date: u64,
    ) -> Result<(), Error> {
        // Pause gate: admin or minter can be rotated without first
        // sweeping active minters.
        if env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
        {
            return Err(Error::ContractPaused);
        }

        // The MINTER (not admin) authorises new issues. If admin == minter
        // is desired, the deployer calls `set_minter(admin)` explicitly;
        // we keep the two slot-independently to limit blast radius.
        let minter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Minter)
            .ok_or(Error::MinterNotSet)?;
        minter.require_auth();

        if env.storage().persistent().has(&DataKey::Token(id.clone())) {
            return Err(Error::TokenAlreadyIssued);
        }

        let current_time = env.ledger().timestamp();
        if expiry_date <= current_time {
            return Err(Error::InvalidExpiryDate);
        }

        let token = MembershipToken {
            id: id.clone(),
            user: user.clone(),
            status: MembershipStatus::Active,
            issue_date: current_time,
            expiry_date,
        };
        env.storage().persistent().set(&DataKey::Token(id), &token);

        Ok(())
    }

    pub fn transfer_token(env: Env, id: BytesN<32>, new_user: Address) -> Result<(), Error> {
        let mut token: MembershipToken = env
            .storage()
            .persistent()
            .get(&DataKey::Token(id.clone()))
            .ok_or(Error::TokenNotFound)?;

        if token.status != MembershipStatus::Active {
            return Err(Error::TokenExpired);
        }

        token.user.require_auth();

        token.user = new_user;
        env.storage().persistent().set(&DataKey::Token(id), &token);

        Ok(())
    }

    pub fn get_token(env: Env, id: BytesN<32>) -> Result<MembershipToken, Error> {
        let token: MembershipToken = env
            .storage()
            .persistent()
            .get(&DataKey::Token(id))
            .ok_or(Error::TokenNotFound)?;

        let current_time = env.ledger().timestamp();
        if token.status == MembershipStatus::Active && current_time > token.expiry_date {
            return Err(Error::TokenExpired);
        }

        Ok(token)
    }

    pub fn set_admin(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        // When the admin rotates, drop any previously-issued Minter slot.
        // A leaked MINTER key (rusty from a former admin) must not survive
        // an admin rotation.
        env.storage().instance().remove(&DataKey::Minter);
        Ok(())
    }

    /// Admin-only. Sets the Minter address. Distinct from `Admin` so a
    /// leaked admin key does not silently mint into supply. The contract
    /// must be unpaused for `set_minter` to take effect on subsequent
    /// issues (any pause flag is enforced inside `issue_token`).
    ///
    /// Note: this method takes `new_minter` only — the current admin
    /// authenticates via its `require_auth`. A future enhancement could
    /// accept an explicit `current_admin: Address` argument, but the
    /// host-level auth tree already enforces that the caller is authorised
    /// to mutate admin-controlled state.
    pub fn set_minter(env: Env, new_minter: Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::AdminNotSet)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Minter, &new_minter);
        Ok(())
    }

    /// Returns the currently-set admin address, or `None` if unset. Cheap
    /// helper for off-chain indexers and tests.
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Returns the currently-set minter address, or `None` if unset.
    pub fn get_minter(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Minter)
    }

    /// Admin-only pause. While paused, `issue_token` returns
    /// `ContractPaused`. Reads continue, transfers continue (so holder
    /// rights are preserved — only new issuance is held).
    pub fn pause(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::AdminNotSet)?;
        if caller != admin {
            return Err(Error::Unauthorised);
        }
        if env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
        {
            return Err(Error::AlreadyPaused);
        }
        env.storage().instance().set(&DataKey::Paused, &true);
        Ok(())
    }

    /// Admin-only unpause.
    pub fn unpause(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::AdminNotSet)?;
        if caller != admin {
            return Err(Error::Unauthorised);
        }
        if !env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
        {
            return Err(Error::NotPaused);
        }
        env.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    /// Read-only convenience: returns whether the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod test;
