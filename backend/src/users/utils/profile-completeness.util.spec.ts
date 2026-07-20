import { computeProfileCompleteness } from './profile-completeness.util';
import { User } from '../entities/user.entity';
import { MembershipStatus } from '../enums/membership-status.enum';
import { UserRole } from '../enums/userRoles.enum';

describe('computeProfileCompleteness', () => {
  const baseUser: Partial<User> = {
    id: 'user-1',
    firstname: '',
    lastname: '',
    isVerified: false,
    phone: null,
    profilePicture: null,
    username: null,
    memberSince: null,
    membershipStatus: MembershipStatus.INACTIVE,
    role: UserRole.USER,
    email: 'test@example.com',
    password: 'hashed',
  };

  it('returns 0 when no fields are filled', () => {
    const score = computeProfileCompleteness(baseUser as User);
    expect(score).toBe(0);
  });

  it('adds 10 points for firstname and lastname', () => {
    const user = { ...baseUser, firstname: 'John', lastname: 'Doe' };
    expect(computeProfileCompleteness(user as User)).toBe(10);
  });

  it('adds 20 points for being verified', () => {
    const user = { ...baseUser, isVerified: true };
    expect(computeProfileCompleteness(user as User)).toBe(20);
  });

  it('adds 15 points for having a phone number', () => {
    const user = { ...baseUser, phone: '+234800000000' };
    expect(computeProfileCompleteness(user as User)).toBe(15);
  });

  it('adds 15 points for having a profile picture', () => {
    const user = { ...baseUser, profilePicture: 'https://example.com/pic.jpg' };
    expect(computeProfileCompleteness(user as User)).toBe(15);
  });

  it('adds 10 points for having a username', () => {
    const user = { ...baseUser, username: 'johndoe' };
    expect(computeProfileCompleteness(user as User)).toBe(10);
  });

  it('adds 10 points for having memberSince date', () => {
    const user = { ...baseUser, memberSince: new Date() };
    expect(computeProfileCompleteness(user as User)).toBe(10);
  });

  it('adds 20 points for ACTIVE membership status', () => {
    const user = { ...baseUser, membershipStatus: MembershipStatus.ACTIVE };
    expect(computeProfileCompleteness(user as User)).toBe(20);
  });

  it('does not add points for INACTIVE or SUSPENDED status', () => {
    const inactive = {
      ...baseUser,
      membershipStatus: MembershipStatus.INACTIVE,
    };
    const suspended = {
      ...baseUser,
      membershipStatus: MembershipStatus.SUSPENDED,
    };
    expect(computeProfileCompleteness(inactive as User)).toBe(0);
    expect(computeProfileCompleteness(suspended as User)).toBe(0);
  });

  it('scores 100 when all fields are complete', () => {
    const user = {
      ...baseUser,
      firstname: 'John',
      lastname: 'Doe',
      isVerified: true,
      phone: '+234800000000',
      profilePicture: 'https://example.com/pic.jpg',
      username: 'johndoe',
      memberSince: new Date('2024-01-01'),
      membershipStatus: MembershipStatus.ACTIVE,
    };
    expect(computeProfileCompleteness(user as User)).toBe(100);
  });
});
