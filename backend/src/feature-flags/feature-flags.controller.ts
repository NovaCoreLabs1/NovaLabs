import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { RolesGuard } from '../auth/guard/roles.guard';
import { JwtAuthGuard } from '../auth/guard/jwt.auth.guard';
import { UserRole } from '../users/enums/userRoles.enum';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * REST surface for the feature-flag module.
 *
 * `GET /api/feature-flags`  – list all known flags and their current state.
 * `POST /api/feature-flags/refresh` – re-read env vars (admin-only).
 *
 * Note: the `POST` route is admin-only because mutating the in-process
 * flag snapshot outside of process restart is a privileged operation;
 * we want the change to be reflected in the audit log.
 */
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Public()
  @Get()
  list() {
    return { flags: this.flags.listFlags() };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  refresh() {
    this.flags.refreshFromEnv();
    return { flags: this.flags.listFlags() };
  }
}
