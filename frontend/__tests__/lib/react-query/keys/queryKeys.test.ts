import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/lib/react-query/keys/queryKeys';

describe('queryKeys', () => {
  it('has workspaces keys', () => {
    expect(queryKeys.workspaces.all).toEqual(['workspaces']);
    expect(queryKeys.workspaces.list({ page: 1 })).toEqual(['workspaces', 'list', { page: 1 }]);
    expect(queryKeys.workspaces.detail('ws-1')).toEqual(['workspaces', 'ws-1']);
    expect(queryKeys.workspaces.availability('ws-1', 5)).toEqual(['workspaces', 'ws-1', 'availability', 5]);
  });

  it('has bookings keys', () => {
    expect(queryKeys.bookings.all).toEqual(['bookings']);
    expect(queryKeys.bookings.mine({ status: 'pending' })).toEqual(['bookings', 'mine', { status: 'pending' }]);
    expect(queryKeys.bookings.detail('bk-1')).toEqual(['bookings', 'bk-1']);
  });

  it('has payments keys', () => {
    expect(queryKeys.payments.mine({})).toEqual(['payments', 'mine', {}]);
  });

  it('has invoices keys', () => {
    expect(queryKeys.invoices.mine({})).toEqual(['invoices', 'mine', {}]);
    expect(queryKeys.invoices.detail('inv-1')).toEqual(['invoices', 'inv-1']);
  });

  it('has notifications keys', () => {
    expect(queryKeys.notifications.all).toEqual(['notifications']);
    expect(queryKeys.notifications.list({ page: 1 })).toEqual(['notifications', 'list', { page: 1 }]);
    expect(queryKeys.notifications.unreadCount).toEqual(['notifications', 'unread-count']);
  });

  it('has workspace-tracking keys', () => {
    expect(queryKeys.workspaceTracking.active).toEqual(['workspace-tracking', 'active']);
    expect(queryKeys.workspaceTracking.history({})).toEqual(['workspace-tracking', 'history', {}]);
  });

  it('has dashboard keys', () => {
    expect(queryKeys.dashboard.member).toEqual(['dashboard', 'member']);
    expect(queryKeys.dashboard.adminAnalytics({ from: '2024-01-01' })).toEqual(['dashboard', 'admin', 'analytics', { from: '2024-01-01' }]);
  });

  it('has two-factor keys', () => {
    expect(queryKeys.twoFactor.status).toEqual(['2fa', 'status']);
  });

  it('has admin keys', () => {
    expect(queryKeys.admin.workspaces.all).toEqual(['admin', 'workspaces']);
    expect(queryKeys.admin.bookings.list({})).toEqual(['admin', 'bookings', 'list', {}]);
    expect(queryKeys.admin.members.all).toEqual(['admin', 'members']);
    expect(queryKeys.admin.members.detail('m-1')).toEqual(['admin', 'members', 'm-1']);
    expect(queryKeys.admin.analytics({})).toEqual(['admin', 'analytics', {}]);
    expect(queryKeys.admin.invoices.all).toEqual(['admin', 'invoices']);
    expect(queryKeys.admin.payments.all).toEqual(['admin', 'payments']);
  });
});
