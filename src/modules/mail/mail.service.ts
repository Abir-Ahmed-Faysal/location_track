import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_SENDER_SMTP_HOST'),
      port: Number(this.configService.get<string>('EMAIL_SENDER_SMTP_PORT') ?? 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('EMAIL_SENDER_SMTP_USER'),
        pass: this.configService.get<string>('EMAIL_SENDER_SMTP_PASS'),
      },
    });
  }

  async sendWelcomeEmail(email: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('EMAIL_SENDER_SMTP_FROM'),
      to: email,
      subject: 'Welcome to our platform',
      html: `<p>Welcome! Thank you for subscribing.</p>`,
    });
  }
}
