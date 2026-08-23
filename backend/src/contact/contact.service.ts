import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage } from './entities/contact-message.entity';
import { SubmitContactDto } from './dto/submit-contact.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepo: Repository<ContactMessage>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Saves a contact form submission to the database, then sends a confirmation
   * email to the submitter and a notification email to the admin team.
   * Both emails are sent non-blocking (fire-and-forget) so failures don't surface to the user.
   * @param dto - Contact form payload (name, email, subject, message)
   * @param ipAddress - Optional IP address of the submitter for rate-limiting logs
   * @returns Success message
   */
  async submit(
    dto: SubmitContactDto,
    ipAddress?: string | null,
  ): Promise<{ message: string }> {
    const contactMessage = this.contactRepo.create({
      ...dto,
      ipAddress: ipAddress || undefined,
    });

    await this.contactRepo.save(contactMessage);
    this.logger.log(`Contact form submitted by ${dto.email}: ${dto.subject}`);

    // Confirmation + admin notification ride the durable queue; enqueue
    // failures are logged inside EmailService and never block the reply
    const userEmailed = await this.emailService.sendContactConfirmation(
      dto.email,
      dto.fullName,
      dto.subject,
    );
    if (!userEmailed) {
      this.logger.warn(`Failed to queue contact confirmation for ${dto.email}`);
    }

    const adminEmailed = await this.emailService.sendContactNotification(
      dto.fullName,
      dto.email,
      dto.subject,
      dto.message,
    );
    if (!adminEmailed) {
      this.logger.warn('Failed to queue contact admin notification');
    }

    return { message: 'Your message has been sent successfully.' };
  }
}
