export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  /**
   * Set by the scheduled expiry sweep when a PENDING booking was never paid
   * before its payment deadline. Expired bookings hold no seats but remain
   * addressable so a late `charge.success` webhook can still be handled
   * deterministically (see HandleWebhookProvider).
   */
  EXPIRED = 'expired',
}
