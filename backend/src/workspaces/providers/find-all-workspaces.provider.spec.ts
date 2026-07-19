import { FindAllWorkspacesProvider } from './find-all-workspaces.provider';
import { WorkspaceType } from '../enums/workspace-type.enum';

describe('FindAllWorkspacesProvider', () => {
  let provider: FindAllWorkspacesProvider;
  let workspacesRepository: any;

  beforeEach(() => {
    workspacesRepository = {
      createQueryBuilder: jest.fn(),
    };
    provider = new FindAllWorkspacesProvider(workspacesRepository);
  });

  function mockQueryBuilder(overrides: any = {}) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(overrides.total ?? 0),
      getMany: jest.fn().mockResolvedValue(overrides.data ?? []),
    };
    workspacesRepository.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  it('returns paginated active workspaces by default', async () => {
    const fakeWorkspaces = [
      { id: 'ws-1', name: 'Hot Desk A' },
      { id: 'ws-2', name: 'Hot Desk B' },
    ];
    mockQueryBuilder({ total: 2, data: fakeWorkspaces });

    const result = await provider.findAll({});

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it('includes inactive workspaces in admin view', async () => {
    const qb = mockQueryBuilder({ total: 0, data: [] });

    await provider.findAll({}, true);

    expect(qb.where).not.toHaveBeenCalledWith(
      'workspace.isActive = :isActive',
      {
        isActive: true,
      },
    );
  });

  it('applies type filter', async () => {
    const qb = mockQueryBuilder({ total: 0, data: [] });

    await provider.findAll({ type: WorkspaceType.MEETING_ROOM });

    expect(qb.andWhere).toHaveBeenCalledWith('workspace.type = :type', {
      type: WorkspaceType.MEETING_ROOM,
    });
  });

  it('applies minSeats filter', async () => {
    const qb = mockQueryBuilder({ total: 0, data: [] });

    await provider.findAll({ minSeats: 5 });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'workspace.availableSeats >= :minSeats',
      { minSeats: 5 },
    );
  });

  it('applies maxRate filter', async () => {
    const qb = mockQueryBuilder({ total: 0, data: [] });

    await provider.findAll({ maxRate: 100000 });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'workspace.hourlyRate <= :maxRate',
      { maxRate: 100000 },
    );
  });

  it('applies search filter', async () => {
    const qb = mockQueryBuilder({ total: 0, data: [] });

    await provider.findAll({ search: 'conference' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(LOWER(workspace.name) LIKE :search OR LOWER(workspace.description) LIKE :search)',
      { search: '%conference%' },
    );
  });

  it('applies pagination', async () => {
    const qb = mockQueryBuilder({ total: 50, data: [] });

    await provider.findAll({ page: 3, limit: 10 });

    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.orderBy).toHaveBeenCalledWith('workspace.createdAt', 'DESC');
  });

  it('calculates totalPages correctly', async () => {
    mockQueryBuilder({ total: 45, data: [] });

    const result = await provider.findAll({ page: 1, limit: 20 });
    expect(result.totalPages).toBe(3);
  });

  it('returns empty result when no workspaces match', async () => {
    mockQueryBuilder({ total: 0, data: [] });

    const result = await provider.findAll({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});
