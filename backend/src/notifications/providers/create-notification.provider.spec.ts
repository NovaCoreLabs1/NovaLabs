import { CreateNotificationProvider } from './create-notification.provider';
import { NotificationType } from '../enums/notification-type.enum';

describe('CreateNotificationProvider', () => {
  let provider: CreateNotificationProvider;
  let notificationsRepository: any;
  let gateway: any;

  beforeEach(() => {
    notificationsRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    gateway = { sendToUser: jest.fn() };

    provider = new CreateNotificationProvider(
      notificationsRepository,
      gateway,
    );
  });

  const input = {
    userId: 'user-1',
    type: NotificationType.BOOKING_CONFIRMED,
    title: 'Booking Confirmed',
    message: 'Your booking has been confirmed.',
  };

  it('creates a notification and pushes real-time event', async () => {
    const savedNotification = {
      id: 'notif-1',
      ...input,
      createdAt: new Date(),
    };
    notificationsRepository.create.mockReturnValue(savedNotification);
    notificationsRepository.save.mockResolvedValue(savedNotification);

    const result = await provider.create(input);

    expect(result).toEqual(savedNotification);
    expect(notificationsRepository.create).toHaveBeenCalledWith(input);
    expect(notificationsRepository.save).toHaveBeenCalledWith(
      savedNotification,
    );
    expect(gateway.sendToUser).toHaveBeenCalledWith('user-1', 'notification', {
      id: 'notif-1',
      type: savedNotification.type,
      title: savedNotification.title,
      message: savedNotification.message,
      createdAt: savedNotification.createdAt,
    });
  });

  it('includes metadata when provided', async () => {
    const inputWithMeta = {
      ...input,
      metadata: { bookingId: 'booking-1', amount: 50000 },
    };
    const savedNotification = {
      id: 'notif-2',
      ...inputWithMeta,
      createdAt: new Date(),
    };
    notificationsRepository.create.mockReturnValue(savedNotification);
    notificationsRepository.save.mockResolvedValue(savedNotification);

    const result = await provider.create(inputWithMeta);

    expect(result.metadata).toEqual({
      bookingId: 'booking-1',
      amount: 50000,
    });
    expect(notificationsRepository.create).toHaveBeenCalledWith(inputWithMeta);
  });
});
