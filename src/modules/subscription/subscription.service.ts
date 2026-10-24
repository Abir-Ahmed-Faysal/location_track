import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async subscribe(email: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { email } });
    if (existing) {
      return { message: 'Already subscribed' };
    }

    await this.prisma.subscription.create({
      data: {
        email,
        status: true,
      },
    });

    setTimeout(() => {
      void this.mailService.sendWelcomeEmail(email);
    }, 30_000);

    return { message: 'Subscription created successfully' };
  }
}
