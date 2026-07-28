import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SamlUserProvisioningService } from './saml-user-provisioning.service';
import { User } from '../../users/entities/user.entity';

describe('SamlUserProvisioningService', () => {
  let provider: SamlUserProvisioningService;

  const usersRepository = {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((data) => data),
    save: jest.fn().mockImplementation(async (data) => ({
      id: 'generated-id',
      ...data,
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamlUserProvisioningService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<SamlUserProvisioningService>(
      SamlUserProvisioningService,
    );
  });

  it('rejects assertions with no resolvable email', async () => {
    await expect(provider.provision({ nameID: undefined })).rejects.toThrow(
      /missing email/i,
    );
  });

  it('creates a new STAFF user when none exists', async () => {
    usersRepository.findOne.mockResolvedValueOnce(null);
    const result = await provider.provision({
      email: 'STAFF@OKTA.COM',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.created).toBe(true);
    expect(result.user.email).toBe('staff@okta.com');
    expect(result.user.firstname).toBe('Jane');
    expect(result.user.lastname).toBe('Doe');
    expect(result.user.role).toBe('staff');
    expect(result.user.isVerified).toBe(true);
    // Password must be a bcrypt-shaped random string, never empty
    expect(result.user.password).toMatch(/^\$2b\$/);
  });

  it('upgrades an existing user to STAFF on first SAML login', async () => {
    usersRepository.findOne.mockResolvedValueOnce({
      id: 'existing-id',
      email: 'admin@example.com',
      role: 'user',
    });
    const result = await provider.provision({
      email: 'admin@example.com',
    });
    expect(result.created).toBe(false);
    expect(result.user.role).toBe('staff');
  });

  it('leaves an already-STAFF user untouched', async () => {
    usersRepository.findOne.mockResolvedValueOnce({
      id: 'existing-id',
      email: 'staff@example.com',
      role: 'staff',
    });
    const result = await provider.provision({
      email: 'staff@example.com',
    });
    expect(result.created).toBe(false);
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('falls back to nameID when email is missing', async () => {
    usersRepository.findOne.mockResolvedValueOnce(null);
    const result = await provider.provision({
      nameID: 'staff-idp@example.com',
    });
    expect(result.user.email).toBe('staff-idp@example.com');
  });
});
