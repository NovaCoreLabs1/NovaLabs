import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserRole } from './enums/userRoles.enum';
import { ROLES_KEY } from '../auth/decorators/roles.decorators';

// The real UsersService transitively requires the ESM-only `archiver`
// package, which jest cannot parse; the controller is instantiated here
// with an inline fake, so the class token alone is needed.
jest.mock('./providers/users.service', () => ({ UsersService: class {} }));

describe('UsersController (issue #226 routing rules)', () => {
  let controller: UsersController;
  let usersService: { findOnePublicById: jest.Mock };

  const targetUserId = '00000000-0000-0000-0000-000000000002';
  const callerId = '00000000-0000-0000-0000-000000000003';

  beforeEach(() => {
    jest.clearAllMocks();
    usersService = {
      findOnePublicById: jest.fn().mockResolvedValue({ id: targetUserId }),
    };
    controller = new UsersController(usersService as unknown as never);
  });

  describe('GET /users/:id', () => {
    it('returns a user reading their own record', async () => {
      await controller.findOne(callerId, callerId, UserRole.USER);

      expect(usersService.findOnePublicById).toHaveBeenCalledWith(callerId);
    });

    it('responds 404 when a non-admin probes another user id', async () => {
      await expect(
        controller.findOne(targetUserId, callerId, UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('responds 404 even when the probed user exists — no enumeration', async () => {
      // usersService would happily return the record; the controller must
      // refuse before the service is ever called.
      await expect(
        controller.findOne(targetUserId, callerId, UserRole.STAFF),
      ).rejects.toThrow(NotFoundException);

      expect(usersService.findOnePublicById).not.toHaveBeenCalled();
    });

    it('lets an admin read any account', async () => {
      await controller.findOne(targetUserId, callerId, UserRole.SUPER_ADMIN);

      expect(usersService.findOnePublicById).toHaveBeenCalledWith(targetUserId);
    });
  });

  describe('route-level admin gating', () => {
    const getRolesMetadata = (
      handler: keyof UsersController,
    ): string[] | undefined =>
      Reflect.getMetadata(ROLES_KEY, (controller as any)[handler]) as
        | string[]
        | undefined;

    it('declares GET /users admin-only via @Roles', () => {
      expect(getRolesMetadata('findAll')).toEqual(
        expect.arrayContaining([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
      );
    });

    it('declares DELETE /users/:id admin-only via @Roles', () => {
      expect(getRolesMetadata('remove')).toEqual(
        expect.arrayContaining([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
      );
    });
  });
});
