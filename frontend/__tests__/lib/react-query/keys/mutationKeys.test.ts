import { describe, it, expect } from 'vitest';
import { mutationKeys } from '@/lib/react-query/keys/mutationKeys';

describe('mutationKeys', () => {
  it('has auth mutation keys', () => {
    expect(mutationKeys.auth.registerUser).toEqual(['auth', 'register']);
    expect(mutationKeys.auth.loginUser).toEqual(['auth', 'login']);
    expect(mutationKeys.auth.forgotPassword).toEqual(['auth', 'forgot-password']);
    expect(mutationKeys.auth.logoutUser).toEqual(['auth', 'logout']);
    expect(mutationKeys.auth.refreshToken).toEqual(['auth', 'refresh']);
  });
});
