import { Module } from '@nestjs/common';
import { SmtpImapProvider } from './smtp-imap.provider';
import { MailProvider } from './mail-provider.interface';

@Module({
  providers: [
    {
      provide: MailProvider,
      useClass: SmtpImapProvider,
    },
  ],
  exports: [MailProvider],
})
export class MailProviderModule {}
