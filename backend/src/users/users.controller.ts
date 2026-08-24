import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  Patch,
  Body,
  Delete,
  HttpStatus,
  Logger,
  Res,
  StreamableFile,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './providers/users.service';
import { GetCurrentUser } from '../auth/decorators/getCurrentUser.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { UserRole } from './enums/userRoles.enum';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';

import { UpdateUserDto } from './dto/updateUser.dto';
import { AnonymiseAccountDto } from './dto/anonymise-account.dto';
import { isAdminLike } from './utils/user-access.util';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Uploads a profile picture for the specified user.
   * Only the account owner or an admin may update the picture.
   */
  @Post(':id/profile-picture')
  @ApiOperation({ summary: 'Upload user profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadProfilePicture(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @GetCurrentUser('id') currentUserId: string,
    @GetCurrentUser('role') currentUserRole: UserRole,
  ) {
    this.logger.log(`Uploading profile picture for user ${id}`);
    const result = await this.usersService.uploadUserProfilePicture(
      id,
      file,
      currentUserId,
      currentUserRole,
    );
    this.logger.log(`Profile picture updated for user ${id}`);
    return {
      message: 'Profile picture updated successfully',
      data: result,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.usersService.resetPassword(body.token, body.newPassword);
  }

  /**
   * Returns a single user. A non-admin actor may only read its own record;
   * any other lookup responds 404 so the member base cannot be enumerated
   * by probing IDs.
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser('id') currentUserId: string,
    @GetCurrentUser('role') currentUserRole: UserRole,
  ) {
    if (currentUserId !== id && !isAdminLike(currentUserRole)) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const user = await this.usersService.findOnePublicById(id);
    return {
      message: 'User retrieved successfully',
      data: user,
    };
  }

  // GET /users — admin-only member listing.
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll() {
    const users = await this.usersService.findAllUsers();
    return { success: true, data: users };
  }

  // PATCH /users/:id — self-service profile edit, admin full edit.
  // Authorization (ownership + field sensitivity + role transitions) is
  // enforced in UpdateUserProvider via the shared user-access helpers.
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateData: UpdateUserDto,
    @GetCurrentUser('id') currentUserId: string,
    @GetCurrentUser('role') currentUserRole: UserRole,
    @GetCurrentUser('email') currentUserEmail: string,
  ) {
    const user = await this.usersService.updateUser(
      id,
      updateData,
      currentUserId,
      currentUserRole,
      currentUserEmail,
    );
    return {
      success: true,
      message: `User ${id} updated successfully`,
      data: user,
    };
  }

  // DELETE /users/:id — hard delete, admin-only. Self-service account
  // removal is DELETE /users/me (GDPR anonymisation) below.
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @GetCurrentUser('id') currentUserId: string,
    @GetCurrentUser('role') currentUserRole: UserRole,
    @GetCurrentUser('email') currentUserEmail: string,
  ) {
    await this.usersService.deleteUser(
      id,
      currentUserId,
      currentUserRole,
      currentUserEmail,
    );
    return;
  }

  // GET /me/export.json
  @Get('me/export.json')
  @ApiOperation({ summary: 'Export all user data (GDPR/CCPA compliance)' })
  async exportUserData(
    @GetCurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    this.logger.log(`Exporting data for user ${userId}`);
    const stream = await this.usersService.exportUserData(userId);
    response.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="user-data-${userId}.zip"`,
    });
    return new StreamableFile(stream);
  }

  /**
   * GDPR Art. 17 — Right to be forgotten.
   *
   * Anonymises the caller's account in place: email is one-way hashed with a
   * per-user salt; credentials, tokens, biometric-tied workspace logs and
   * all other PII are erased; financial records (bookings, payments) are
   * decoupled from the user (userId set to NULL) and the action is recorded
   * in the audit log. Returns HTTP 204 on success.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Anonymise the authenticated user (GDPR Art. 17)',
    description:
      'Irreversibly deletes the caller’s personal data while preserving ' +
      'anonymised financial records (bookings, payments) for accounting ' +
      'compliance. The user row is preserved with a synthetic email so ' +
      'foreign-key references remain intact but re-authentication is ' +
      'impossible.',
  })
  @ApiProduces('application/json')
  async anonymiseMe(
    @GetCurrentUser('id') userId: string,
    @Body() dto?: AnonymiseAccountDto,
  ): Promise<void> {
    this.logger.log(`Anonymising account for user ${userId} (GDPR Art. 17)`);
    await this.usersService.anonymiseMyAccount(userId, dto?.reason);
    this.logger.log(`Anonymisation complete for user ${userId}`);
  }
}
