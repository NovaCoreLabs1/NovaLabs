import { Test, TestingModule } from '@nestjs/testing';
import { UpdateMemberStatusProvider } from './update-member-status.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '../enums/membership-status.enum';

describe('UpdateMemberStatusProvider', () => {
  let provider: UpdateMemberStatusProvider;
  let usersRepository: any;

  const baseUser = {
    id: 'member-1',
    firstname: 'Alice',
    lastname: 'Smith',
    membershipStatus: MembershipStatus.INACTIVE,
    isSuspended: false,
    isActive: true,
    memberSince: null,
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateMemberStatusProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<UpdateMemberStatusProvider>(
      UpdateMemberStatusProvider,
    );
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('updateStatus', () => {
    it('activates a member and sets memberSince when first time', async () => {
      usersRepository.findOne.mockResolvedValue({ ...baseUser });
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await provider.updateStatus(
        'member-1',
        MembershipStatus.ACTIVE,
      );

      expect(result.membershipStatus).toBe(MembershipStatus.ACTIVE);
      expect(result.isSuspended).toBe(false);
      expect(result.isActive).toBe(true);
      expect(result.memberSince).toBeInstanceOf(Date);
    });

    it('suspends a member and updates sync flags', async () => {
      const activeUser = {
        ...baseUser,
        membershipStatus: MembershipStatus.ACTIVE,
        memberSince: new Date('2024-01-01'),
      };
      usersRepository.findOne.mockResolvedValue(activeUser);
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await provider.updateStatus(
        'member-1',
        MembershipStatus.SUSPENDED,
      );

      expect(result.membershipStatus).toBe(MembershipStatus.SUSPENDED);
      expect(result.isSuspended).toBe(true);
      expect(result.isActive).toBe(false);
    });

    it('sets member inactive', async () => {
      const activeUser = {
        ...baseUser,
        membershipStatus: MembershipStatus.ACTIVE,
        memberSince: new Date('2024-01-01'),
      };
      usersRepository.findOne.mockResolvedValue(activeUser);
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await provider.updateStatus(
        'member-1',
        MembershipStatus.INACTIVE,
      );

      expect(result.membershipStatus).toBe(MembershipStatus.INACTIVE);
      expect(result.isSuspended).toBe(false);
      expect(result.isActive).toBe(true);
    });

    it('does not overwrite existing memberSince on reactivation', async () => {
      const existingSince = new Date('2023-06-15');
      const activeUser = {
        ...baseUser,
        memberSince: existingSince,
      };
      usersRepository.findOne.mockResolvedValue(activeUser);
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await provider.updateStatus(
        'member-1',
        MembershipStatus.ACTIVE,
      );

      expect(result.memberSince).toEqual(existingSince);
    });

    it('throws NotFoundException when member not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.updateStatus('nonexistent', MembershipStatus.ACTIVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-throws error when repository fails', async () => {
      usersRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        provider.updateStatus('member-1', MembershipStatus.ACTIVE),
      ).rejects.toThrow('DB error');
    });
  });
});
