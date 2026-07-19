import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryService } from './cloudinary.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

const mockUploadStream = { end: jest.fn() };

jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

// Import cloudinary AFTER the mock is set up (jest.mock is hoisted)
import { v2 as cloudinary } from 'cloudinary';
const cloudinaryUploader = cloudinary.uploader as any;

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    configService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  describe('uploadImage', () => {
    const mockFile = {
      buffer: Buffer.from('fake-image-data'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    it('uploads image with default folder', async () => {
      configService.get.mockReturnValue(undefined);
      cloudinaryUploader.upload_stream.mockImplementation(
        (_options: any, callback: Function) => {
          callback(null, {
            secure_url:
              'https://res.cloudinary.com/demo/image/upload/v1/profile-pictures/abc123',
            public_id: 'profile-pictures/abc123',
          });
          return mockUploadStream;
        },
      );

      const result = await service.uploadImage(mockFile);

      expect(result).toHaveProperty('secure_url');
      expect(result).toHaveProperty('public_id', 'profile-pictures/abc123');
      expect(mockUploadStream.end).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('uploads image with custom folder', async () => {
      cloudinaryUploader.upload_stream.mockImplementation(
        (_options: any, callback: Function) => {
          callback(null, {
            secure_url:
              'https://res.cloudinary.com/demo/image/upload/v1/custom/test123',
            public_id: 'custom/test123',
          });
          return mockUploadStream;
        },
      );

      const result = await service.uploadImage(mockFile, 'custom');

      expect(result).toHaveProperty('public_id', 'custom/test123');
    });

    it('rejects on upload error', async () => {
      cloudinaryUploader.upload_stream.mockImplementation(
        (_options: any, callback: Function) => {
          callback(new Error('Upload failed'), null);
          return mockUploadStream;
        },
      );

      await expect(service.uploadImage(mockFile)).rejects.toThrow(
        'Upload failed',
      );
    });
  });

  describe('deleteImage', () => {
    it('deletes image by publicId', async () => {
      cloudinaryUploader.destroy.mockResolvedValue({
        result: 'ok',
      });

      const result = await service.deleteImage('profile-pictures/abc123');
      expect(result).toEqual({ result: 'ok' });
      expect(cloudinaryUploader.destroy).toHaveBeenCalledWith(
        'profile-pictures/abc123',
      );
    });

    it('throws BadRequestException on delete error', async () => {
      cloudinaryUploader.destroy.mockRejectedValue(new Error('Delete failed'));

      await expect(
        service.deleteImage('profile-pictures/abc123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('extractPublicIdFromUrl', () => {
    it('extracts public_id from Cloudinary URL', () => {
      const url =
        'https://res.cloudinary.com/demo/image/upload/v1/profile-pictures/abc123.jpg';
      const result = service.extractPublicIdFromUrl(url);
      expect(result).toBe('profile-pictures/abc123');
    });

    it('handles URLs without extension', () => {
      const url =
        'https://res.cloudinary.com/demo/image/upload/v1/folder/test_image';
      const result = service.extractPublicIdFromUrl(url);
      expect(result).toBe('folder/test_image');
    });
  });
});
