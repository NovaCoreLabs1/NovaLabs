import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { WorkspaceTrackingService } from './workspace-tracking.service';
import { CheckInDto } from './dto/check-in.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';
import { SetupPinDto } from './dto/setup-pin.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { AuthenticatedCheckInDto } from './dto/authenticated-check-in.dto';
import { GetCurrentUser } from '../auth/decorators/getCurrentUser.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { RolesGuard } from '../auth/guard/roles.guard';
import { UserRole } from '../users/enums/userRoles.enum';
import { CheckInAuthProvider } from './providers/check-in-auth.provider';

@ApiTags('Workspace Tracking')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('workspace-tracking')
export class WorkspaceTrackingController {
  constructor(
    private readonly workspaceTrackingService: WorkspaceTrackingService,
    private readonly checkInAuthProvider: CheckInAuthProvider,
  ) {}

  /**
   * Records a check-in for the authenticated user.
   * Creates a workspace log entry with an open check-in timestamp.
   */
  @Post('check-in')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check into a workspace' })
  async checkIn(@Body() dto: CheckInDto, @GetCurrentUser('id') userId: string) {
    const data = await this.workspaceTrackingService.checkIn(dto, userId);
    return { message: 'Checked in successfully', data };
  }

  @Patch('check-out/:logId')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check out of a workspace' })
  async checkOut(
    @Param('logId', ParseUUIDPipe) logId: string,
    @GetCurrentUser('id') userId: string,
  ) {
    const data = await this.workspaceTrackingService.checkOut(logId, userId);
    return { message: 'Checked out successfully', data };
  }

  @Get('active')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get my current active check-in' })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  async getActiveCheckIn(
    @GetCurrentUser('id') userId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const data = await this.workspaceTrackingService.getActiveCheckIn(
      userId,
      workspaceId,
    );
    return { message: 'Active check-in retrieved', data };
  }

  @Get('occupancy')
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get current occupancy for all (or one) workspace' })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  async getCurrentOccupancy(@Query('workspaceId') workspaceId?: string) {
    const data =
      await this.workspaceTrackingService.getCurrentOccupancy(workspaceId);
    return { message: 'Occupancy retrieved', data };
  }

  @Get('utilization')
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get utilization statistics' })
  async getUtilizationStats(@Query() query: OccupancyQueryDto) {
    const data = await this.workspaceTrackingService.getUtilizationStats(query);
    return { message: 'Utilization stats retrieved', data };
  }

  @Get('logs')
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get recent check-in logs' })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentLogs(
    @Query('workspaceId') workspaceId?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.workspaceTrackingService.getRecentLogs(
      workspaceId,
      limit ? Number(limit) : 50,
    );
    return { message: 'Recent logs retrieved', data };
  }

  // ─────────────────────────────────────────────
  // PIN & Biometric Authentication Endpoints
  // ─────────────────────────────────────────────

  /**
   * Gets the current authentication status for check-in.
   * Returns whether PIN and/or biometric are set up.
   */
  @Get('auth/status')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get check-in authentication status' })
  async getAuthStatus(@GetCurrentUser('id') userId: string) {
    const data = await this.checkInAuthProvider.getAuthStatus(userId);
    return { message: 'Auth status retrieved', data };
  }

  /**
   * Sets up a 4-digit PIN for check-in fallback authentication.
   */
  @Post('auth/pin/setup')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set up check-in PIN' })
  async setupPin(
    @Body() dto: SetupPinDto,
    @GetCurrentUser('id') userId: string,
  ) {
    const data = await this.checkInAuthProvider.setupPin(userId, dto);
    return { message: 'PIN set up successfully', data };
  }

  /**
   * Changes the check-in PIN. Requires current PIN and optional 2FA.
   */
  @Patch('auth/pin/change')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change check-in PIN' })
  async changePin(
    @Body() dto: ChangePinDto,
    @GetCurrentUser('id') userId: string,
  ) {
    const data = await this.checkInAuthProvider.changePin(userId, dto);
    return { message: 'PIN changed successfully', data };
  }

  /**
   * Removes the check-in PIN. Requires current PIN verification.
   */
  @Delete('auth/pin')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove check-in PIN' })
  async removePin(
    @Body('currentPin') currentPin: string,
    @GetCurrentUser('id') userId: string,
  ) {
    const data = await this.checkInAuthProvider.removePin(userId, currentPin);
    return { message: 'PIN removed successfully', data };
  }

  /**
   * Performs an authenticated check-in with PIN or biometric verification.
   * Falls back to PIN if biometric fails.
   */
  @Post('check-in/authenticated')
  @Roles(UserRole.USER, UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check into workspace with PIN/biometric authentication' })
  async authenticatedCheckIn(
    @Body() dto: AuthenticatedCheckInDto,
    @GetCurrentUser('id') userId: string,
  ) {
    // Verify authentication
    const verifiedAuthMethod = await this.checkInAuthProvider.verifyCheckInAuth(
      userId,
      dto,
    );

    // Perform check-in with verified auth method
    const data = await this.workspaceTrackingService.authenticatedCheckIn(
      dto,
      userId,
      verifiedAuthMethod,
    );

    return {
      message: 'Checked in successfully',
      data,
      authMethod: verifiedAuthMethod,
    };
  }
}
