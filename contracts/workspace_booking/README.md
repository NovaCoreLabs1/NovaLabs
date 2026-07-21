# Workspace Booking Contract

A workspace booking/reservation contract for managing physical or virtual workspaces.

## Overview

The Workspace Booking contract enables members to reserve workspaces for specific time slots. Payment is collected at booking time, with support for cancellations, completions, and availability management.

## Features

- **Workspace Registration**: Admins register bookable workspaces
- **Time Slot Booking**: Members book workspaces for specific periods
- **Payment Integration**: Automatic payment collection at booking
- **Overlap Detection**: Prevents double-booking of time slots
- **Cancellation Support**: Full refund on cancellation
- **Availability Management**: Toggle workspace availability

## Public Functions

| Function | Description | Access |
|----------|-------------|--------|
| `initialize(admin, payment_token)` | Initialize contract | Admin (once) |
| `register_workspace(caller, id, name, type, capacity, rate)` | Register a workspace | Admin |
| `set_workspace_availability(caller, id, available)` | Toggle availability | Admin |
| `set_workspace_rate(caller, id, rate)` | Update hourly rate | Admin |
| `book_workspace(member, booking_id, workspace_id, start, end)` | Book a workspace | Member |
| `cancel_booking(caller, booking_id)` | Cancel booking | Member/Admin |
| `complete_booking(caller, booking_id)` | Mark booking completed | Admin |
| `get_workspace(workspace_id)` | Get workspace details | Public |
| `get_booking(booking_id)` | Get booking details | Public |
| `get_all_workspaces()` | List all workspaces | Public |
| `get_member_bookings(member)` | List member's bookings | Public |
| `get_workspace_bookings(workspace_id)` | List workspace bookings | Public |
| `check_availability(workspace_id, start, end)` | Check slot availability | Public |

## Booking States

```
Booked → Completed
      → Cancelled (full refund)
```

## Usage

### Register a Workspace

```rust
use workspace_booking::WorkspaceBooking;

WorkspaceBooking::register_workspace(
    env,
    admin,
    workspace_id,
    "Conference Room A",
    "meeting_room",
    10, // capacity
    50_000_000, // hourly rate in stroops
)?;
```

### Book a Workspace

```rust
// Member books workspace with payment
WorkspaceBooking::book_workspace(
    env,
    member,
    booking_id,
    workspace_id,
    start_timestamp,
    end_timestamp,
)?;
```

### Check Availability

```rust
let available = WorkspaceBooking::check_availability(
    env,
    workspace_id,
    start_timestamp,
    end_timestamp,
)?;
```

## Testing

```bash
cargo test -p workspace_booking
```

## Security Considerations

- Reentrancy guards on all payment operations
- Overlap detection prevents double-booking
- Full refund on cancellation
- Admin authorization for workspace management

## License

Part of the NovaLabs project.
