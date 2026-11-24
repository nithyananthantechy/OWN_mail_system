'use client';

import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function SentPage() {
  return (
    <MailList
      folder="sent"
      title="Sent"
      queryKey="sent"
      queryFn={(accountId, page) => mailApi.getFolder('SENT', accountId, page)}
    />
  );
}
