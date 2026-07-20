import { Test, TestingModule } from '@nestjs/testing';
import { UploadProfilePictureProvider } from './uploadProfilePicture.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { BadRequestException } from '@nestjs/common';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { UserRole } from '../enums/userRoles.enum';

describe('UploadProfilePictureProvider', () => {
  let provider: UploadProfilePictureProvider;
  let usersRepository: any;
  let cloudinaryService: any;

  const mockFile = {
    buffer: Buffer.from('fake-image-data'),
    mimetype: 'image/jpeg',
    originalname: 'photo.jpg',
    size: 1024,
  } as Express.Multer.File;

  const existingUser = {
    id: 'user-1',
    firstname: 'Alice',
    profilePicture: null,
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    cloudinaryService = {
      uploadImage: jest.fn(),
      extractPublicIdFromUrl: jest.fn(),
      deleteImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadProfilePictureProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: CloudinaryService, useValue: cloudinaryService },
      ],
    }).compile();

    provider = module.get<UploadProfilePictureProvider>(
      UploadProfilePictureProvider,
    );
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('uploadProfilePicture', () => {
    it('uploads picture for own user', async () => {
      usersRepository.findOne.mockResolvedValue(existingUser);
      cloudinaryService.uploadImage.mockResolvedValue({
        secure_url: 'https://cloudinary.com/pic.jpg',
      });
      usersRepository.save.mockImplementation((user) =>
        Promise.resolve({
          ...user,
          id: 'user-1',
        }),
      );

      const result = await provider.uploadProfilePicture(
        'user-1',
        mockFile,
        'user-1',
        UserRole.USER,
      );

      expect(result).toEqual({
        id: 'user-1',
        profilePicture: 'https://cloudinary.com/pic.jpg',
      });
      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(
        mockFile,
        'profile-pictures',
      );
    });

    it('allows admin to upload picture for another user', async () => {
      usersRepository.findOne.mockResolvedValue(existingUser);
      cloudinaryService.uploadImage.mockResolvedValue({
        secure_url: 'https://cloudinary.com/pic.jpg',
      });
      usersRepository.save.mockImplementation((user) =>
        Promise.resolve({
          ...user,
          id: 'target-user',
        }),
      );

      const result = await provider.uploadProfilePicture(
        'target-user',
        mockFile,
        'admin-1',
        UserRole.ADMIN,
      );

      expect(result.id).toBe('target-user');
    });

    it('throws BadRequestException when non-admin user tries to update another user', async () => {
      await expect(
        provider.uploadProfilePicture(
          'other-user',
          mockFile,
          'user-1',
          UserRole.USER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when target user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.uploadProfilePicture(
          'nonexistent',
          mockFile,
          'user-1',
          UserRole.USER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes old profile picture when replacing', async () => {
      const userWithPicture = {
        ...existingUser,
        profilePicture: 'https://cloudinary.com/old-pic.jpg',
      };
      usersRepository.findOne.mockResolvedValue(userWithPicture);
      cloudinaryService.uploadImage.mockResolvedValue({
        secure_url: 'https://cloudinary.com/new-pic.jpg',
      });
      cloudinaryService.extractPublicIdFromUrl.mockReturnValue(
        'profile-pictures/old-pic',
      );
      cloudinaryService.deleteImage.mockResolvedValue({ result: 'ok' });
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      await provider.uploadProfilePicture(
        'user-1',
        mockFile,
        'user-1',
        UserRole.USER,
      );

      expect(cloudinaryService.extractPublicIdFromUrl).toHaveBeenCalledWith(
        'https://cloudinary.com/old-pic.jpg',
      );
      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith(
        'profile-pictures/old-pic',
      );
    });

    it('handles old picture deletion error gracefully', async () => {
      const userWithPicture = {
        ...existingUser,
        profilePicture: 'https://cloudinary.com/old-pic.jpg',
      };
      usersRepository.findOne.mockResolvedValue(userWithPicture);
      cloudinaryService.uploadImage.mockResolvedValue({
        secure_url: 'https://cloudinary.com/new-pic.jpg',
      });
      cloudinaryService.extractPublicIdFromUrl.mockReturnValue(
        'profile-pictures/old-pic',
      );
      cloudinaryService.deleteImage.mockRejectedValue(
        new Error('Delete failed'),
      );
      usersRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await provider.uploadProfilePicture(
        'user-1',
        mockFile,
        'user-1',
        UserRole.USER,
      );

      // Should still succeed despite old image deletion failure
      expect(result.profilePicture).toBe('https://cloudinary.com/new-pic.jpg');
    });

    it('throws BadRequestException on upload failure', async () => {
      usersRepository.findOne.mockResolvedValue(existingUser);
      cloudinaryService.uploadImage.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(
        provider.uploadProfilePicture(
          'user-1',
          mockFile,
          'user-1',
          UserRole.USER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
