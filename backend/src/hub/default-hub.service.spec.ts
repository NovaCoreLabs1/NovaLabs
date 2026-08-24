import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Hub } from './entities/hub.entity';
import { DEFAULT_HUB_SLUG, DefaultHubService } from './default-hub.service';

describe('DefaultHubService (issue #225)', () => {
  let service: DefaultHubService;
  let hubsRepository: { findOne: jest.Mock; save: jest.Mock };

  const existingHub = {
    id: '00000000-0000-0000-0000-0000000000d1',
    slug: DEFAULT_HUB_SLUG,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    hubsRepository = {
      findOne: jest.fn().mockResolvedValue(existingHub),
      save: jest.fn().mockResolvedValue(existingHub),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DefaultHubService,
        { provide: getRepositoryToken(Hub), useValue: hubsRepository },
      ],
    }).compile();

    service = moduleRef.get(DefaultHubService);
  });

  it('reuses the existing default hub and caches its UUID', async () => {
    const id = await service.ensureDefaultHub();

    expect(id).toBe('00000000-0000-0000-0000-0000000000d1');
    expect(hubsRepository.findOne).toHaveBeenCalledWith({
      where: { slug: DEFAULT_HUB_SLUG },
    });
    expect(hubsRepository.save).not.toHaveBeenCalled();
    expect(service.defaultHubId).toBe(id);
  });

  it('creates the default hub when missing (fresh deployment)', async () => {
    hubsRepository.findOne.mockResolvedValueOnce(null);
    hubsRepository.save.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000new',
      slug: DEFAULT_HUB_SLUG,
    });

    const id = await service.ensureDefaultHub();

    expect(id).toBe('00000000-0000-0000-0000-000000000new');
    expect(service.defaultHubId).toBe(id);
  });

  it('recovers from a unique-slug creation race by reading the winner', async () => {
    hubsRepository.findOne
      .mockResolvedValueOnce(null) // pre-check: missing
      .mockResolvedValueOnce(existingHub); // post-race re-read

    const id = await service.ensureDefaultHub();

    expect(id).toBe(existingHub.id);
    expect(service.defaultHubId).toBe(existingHub.id);
  });

  it('reports undefined before boot-time resolution ran', () => {
    expect(service.defaultHubId).toBeUndefined();
  });
});
