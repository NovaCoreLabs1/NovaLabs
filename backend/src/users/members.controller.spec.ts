import { Test, TestingModule } from '@nestjs/testing';
import { MembersController } from './members.controller';
import { UsersService } from './providers/users.service';
import { MembershipStatus } from './enums/membership-status.enum';

describe('MembersController', () => {
  let controller: MembersController;
  let usersService: any;

  const mockMember = {
    id: 'member-1',
    firstname: 'Alice',
    lastname: 'Smith',
    email: 'alice@example.com',
    membershipStatus: MembershipStatus.ACTIVE,
  };

  beforeEach(async () => {
    usersService = {
      getMemberStats: jest.fn(),
      getMemberProfile: jest.fn(),
      getMembers: jest.fn(),
      updateMemberStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<MembersController>(MembersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('returns member stats', async () => {
      const stats = {
        total: 100,
        active: 60,
        inactive: 30,
        suspended: 10,
        verified: 80,
      };
      usersService.getMemberStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(result).toEqual({
        message: 'Member stats retrieved',
        data: stats,
      });
    });
  });

  describe('getMyProfile', () => {
    it('returns current user profile', async () => {
      usersService.getMemberProfile.mockResolvedValue(mockMember);

      const result = await controller.getMyProfile('member-1');

      expect(result).toEqual({
        message: 'Profile retrieved successfully',
        data: mockMember,
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated members', async () => {
      const paginatedResult = {
        data: [mockMember],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      usersService.getMembers.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({});

      expect(result).toEqual({
        message: 'Members retrieved successfully',
        ...paginatedResult,
      });
      expect(usersService.getMembers).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('returns member by id', async () => {
      usersService.getMemberProfile.mockResolvedValue(mockMember);

      const result = await controller.findOne('member-1');

      expect(result).toEqual({
        message: 'Member retrieved successfully',
        data: mockMember,
      });
    });
  });

  describe('updateStatus', () => {
    it('updates member status', async () => {
      usersService.updateMemberStatus.mockResolvedValue({
        ...mockMember,
        membershipStatus: MembershipStatus.SUSPENDED,
      });

      const result = await controller.updateStatus('member-1', {
        status: MembershipStatus.SUSPENDED,
      });

      expect(result).toEqual({
        message: 'Member status updated successfully',
        data: expect.objectContaining({
          membershipStatus: MembershipStatus.SUSPENDED,
        }),
      });
      expect(usersService.updateMemberStatus).toHaveBeenCalledWith(
        'member-1',
        MembershipStatus.SUSPENDED,
      );
    });
  });
});
