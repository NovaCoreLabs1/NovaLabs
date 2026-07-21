# Resource Credits Contract

An internal credit (utility token) contract for managing per-member balances of resource credits.

## Overview

The Resource Credits contract provides a simple accounting ledger for internal platform credits. It supports minting (admin), peer-to-peer transfers, and spending/burning operations.

## Features

- **Credit Minting**: Admin can mint credits to any member
- **Peer-to-Peer Transfer**: Members can transfer credits to each other
- **Credit Spending**: Burn credits for platform services
- **Balance Tracking**: Real-time balance queries
- **Supply Tracking**: Global total supply monitoring

## Public Functions

| Function | Description | Access |
|----------|-------------|--------|
| `initialize(admin, payment_token)` | Initialize contract | Admin (once) |
| `mint_credits(caller, recipient, amount)` | Mint credits to recipient | Admin |
| `transfer_credits(from, to, amount)` | Transfer credits peer-to-peer | Credit holder |
| `spend_credits(member, amount)` | Burn credits from balance | Credit holder |
| `balance(member)` | Get member's credit balance | Public |
| `total_supply()` | Get total credit supply | Public |

## Usage

### Mint Credits

```rust
use resource_credits::ResourceCredits;

// Admin mints credits to a member
ResourceCredits::mint_credits(env, admin, recipient, 1000)?;
```

### Transfer Credits

```rust
// Peer-to-peer transfer
ResourceCredits::transfer_credits(env, from, to, 500)?;
```

### Spend Credits

```rust
// Burn credits for a service
ResourceCredits::spend_credits(env, member, 100)?;
```

### Check Balance

```rust
let balance = ResourceCredits::balance(env, member)?;
```

## Testing

```bash
cargo test -p resource_credits
```

## Security Considerations

- Only admins can mint credits
- Transfers require sender authorization
- Balance checks prevent overdrafts
- All operations emit events for audit

## License

Part of the NovaLabs project.
