# Manage Hub Contract

The central orchestrator contract for NovaLabs, acting as a facade for membership tokens, subscriptions, tier management, and more.

## Overview

Manage Hub is the main entry point for the NovaLabs platform. It delegates to multiple internal modules covering:

- Membership token issuance, transfer, and management
- Subscription lifecycle (create, renew, pause, cancel)
- Tier management and promotions
- Attendance logging and analytics
- Token metadata and renewals
- Emergency pause functionality
- Staking and token upgrades
- Fractionalization and royalty management

## Features

- **66+ Public Functions**: Comprehensive API for all platform operations
- **Multisig Support**: Critical admin operations require multi-party approval
- **Batch Operations**: Efficient bulk token minting, transfers, and updates
- **Emergency Controls**: Contract-wide pause for security incidents
- **Staking System**: Token staking with configurable tiers and rewards

## Public Functions

### Membership Token Core
| Function | Description |
|----------|-------------|
| `issue_token` | Mint a new membership token |
| `transfer_token` | Transfer token to another address |
| `get_token` | Retrieve token details |
| `set_admin` | Set contract administrator |

### Subscriptions
| Function | Description |
|----------|-------------|
| `create_subscription` | Create a new subscription |
| `renew_subscription` | Renew an expiring subscription |
| `cancel_subscription` | Cancel a subscription |
| `pause_subscription` | Pause subscription temporarily |
| `resume_subscription` | Resume a paused subscription |
| `get_subscription` | Get subscription details |

### Tier Management
| Function | Description |
|----------|-------------|
| `create_tier` | Create a new subscription tier |
| `update_tier` | Update tier configuration |
| `get_tier` | Get tier details |
| `get_all_tiers` | List all tiers |
| `deactivate_tier` | Deactivate a tier |

### Attendance
| Function | Description |
|----------|-------------|
| `log_attendance` | Log user attendance |
| `get_logs_for_user` | Get attendance logs for user |
| `get_attendance_summary` | Get attendance analytics |

### Token Metadata
| Function | Description |
|----------|-------------|
| `set_token_metadata` | Set token metadata |
| `get_token_metadata` | Get token metadata |
| `update_token_metadata` | Update metadata |

### Emergency Controls
| Function | Description |
|----------|-------------|
| `emergency_pause` | Pause all contract operations |
| `emergency_unpause` | Resume contract operations |
| `is_contract_paused` | Check if contract is paused |

## Usage

### Basic Token Operations

```rust
use manage_hub::ManageHub;

// Issue a token
ManageHub::issue_token(env, admin, token_id, user, expiry_date)?;

// Transfer a token
ManageHub::transfer_token(env, caller, token_id, new_owner)?;

// Get token details
let token = ManageHub::get_token(env, token_id)?;
```

### Subscription Management

```rust
// Create a subscription
ManageHub::create_subscription(env, user, plan, start_date)?;

// Renew subscription
ManageHub::renew_subscription(env, user, subscription_id)?;
```

## Testing

```bash
cargo test -p manage_hub
```

## Security Considerations

- Admin operations require proper authorization
- Critical operations may require multisig approval
- Emergency pause is available for security incidents
- Reentrancy guards protect fund-moving operations

## License

Part of the NovaLabs project.
