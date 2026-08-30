import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaystackProvider } from './paystack.provider';
import { UserRole } from '../../users/enums/userRoles.enum';

@Injectable()
export class RefundPaymentProvider {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly paystackProvider: PaystackProvider,
  ) {}

  async refund(
    paymentId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment "${paymentId}" not found`);
    }

    const isAdmin =
      requestingUserRole === UserRole.ADMIN ||
      requestingUserRole === UserRole.SUPER_ADMIN;

    if (!isAdmin && payment.userId !== requestingUserId) {
      throw new ForbiddenException('You can only refund your own payments');
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        `Only SUCCESS payments can be refunded. Current status: ${payment.status}`,
      );
    }

    await this.paystackProvider.initiateRefund(payment.providerReference);

    // Atomic transition: SUCCESS → REFUNDED with a conditional UPDATE.
    // Prevents a concurrent refund request from double-initiating the
    // Paystack refund or flipping an already-refunded payment.
    const result = await this.paymentsRepository
      .createQueryBuilder()
      .update(Payment)
      .set({ status: PaymentStatus.REFUNDED })
      .where('id = :id AND status = :status', {
        id: payment.id,
        status: PaymentStatus.SUCCESS,
      })
      .execute();

    if (result.affected === 0) {
      const current = await this.paymentsRepository.findOne({
        where: { id: payment.id },
      });
      if (current?.status === PaymentStatus.REFUNDED) {
        // Already refunded by a concurrent request — idempotent.
        return current;
      }
      throw new BadRequestException(
        `Payment "${paymentId}" is no longer in a refundable state (${current?.status})`,
      );
    }

    // Read back the updated entity for the return value.
    return (await this.paymentsRepository.findOne({
      where: { id: payment.id },
    }))!;
  }
}
