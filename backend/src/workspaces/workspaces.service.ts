import { Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceQueryDto } from './dto/workspace-query.dto';
import { CreateWorkspaceProvider } from './providers/create-workspace.provider';
import { FindAllWorkspacesProvider } from './providers/find-all-workspaces.provider';
import { FindWorkspaceByIdProvider } from './providers/find-workspace-by-id.provider';
import { UpdateWorkspaceProvider } from './providers/update-workspace.provider';
import { DeleteWorkspaceProvider } from './providers/delete-workspace.provider';
import { CheckWorkspaceAvailabilityProvider } from './providers/check-workspace-availability.provider';
import { Workspace } from './entities/workspace.entity';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly createWorkspaceProvider: CreateWorkspaceProvider,
    private readonly findAllWorkspacesProvider: FindAllWorkspacesProvider,
    private readonly findWorkspaceByIdProvider: FindWorkspaceByIdProvider,
    private readonly updateWorkspaceProvider: UpdateWorkspaceProvider,
    private readonly deleteWorkspaceProvider: DeleteWorkspaceProvider,
    private readonly checkWorkspaceAvailabilityProvider: CheckWorkspaceAvailabilityProvider,
  ) {}

  /**
   * Creates a new workspace. Restricted to Admin/Super Admin.
   * @param dto - Workspace creation payload
   */
  create(dto: CreateWorkspaceDto) {
    return this.createWorkspaceProvider.create(dto);
  }

  /**
   * Retrieves all workspaces with optional filters and pagination.
   * @param query - Filter and pagination options
   * @param adminView - When true, includes inactive/deleted workspaces (admin use)
   */
  findAll(query: WorkspaceQueryDto, adminView = false) {
    return this.findAllWorkspacesProvider.findAll(query, adminView);
  }

  /**
   * Retrieves a single workspace by its UUID.
   * @param id - Workspace UUID
   * @throws NotFoundException if workspace does not exist
   */
  findById(id: string): Promise<Workspace> {
    return this.findWorkspaceByIdProvider.findById(id);
  }

  /**
   * Updates workspace details. Restricted to Admin/Staff.
   * @param id - Workspace UUID
   * @param dto - Partial update payload
   */
  update(id: string, dto: UpdateWorkspaceDto) {
    return this.updateWorkspaceProvider.update(id, dto);
  }

  /**
   * Soft-deletes (deactivates) a workspace. Restricted to Admin/Super Admin.
   * @param id - Workspace UUID
   */
  softDelete(id: string) {
    return this.deleteWorkspaceProvider.softDelete(id);
  }

  /**
   * Checks whether the workspace has sufficient available seats for the
   * requested window. Availability is derived live from PENDING and
   * CONFIRMED bookings overlapping [startDate, endDate].
   * @param workspaceId - Workspace UUID
   * @param requestedSeats - Number of seats required (defaults to 1)
   * @param window - Optional inclusive YYYY-MM-DD window; defaults to today
   */
  checkAvailability(
    workspaceId: string,
    requestedSeats?: number,
    window?: {
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.checkWorkspaceAvailabilityProvider.check(
      workspaceId,
      requestedSeats,
      window,
    );
  }
}
