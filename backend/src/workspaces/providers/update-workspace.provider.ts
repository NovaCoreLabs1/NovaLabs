import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { FindWorkspaceByIdProvider } from './find-workspace-by-id.provider';

@Injectable()
export class UpdateWorkspaceProvider {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    private readonly findWorkspaceByIdProvider: FindWorkspaceByIdProvider,
  ) {}

  async update(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    const workspace = await this.findWorkspaceByIdProvider.findById(id);

    Object.assign(workspace, dto);
    return this.workspacesRepository.save(workspace);
  }
}
