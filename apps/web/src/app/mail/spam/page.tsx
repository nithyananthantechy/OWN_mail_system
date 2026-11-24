'use client';

import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function SpamPage() {
  return (
    <MailList
      folder="spam"
      title="Spam"
      queryKey="spam"
      queryFn={(accountId, page) => mailApi.getFolder('SPAM', accountId, page)}
    />
  );
}
