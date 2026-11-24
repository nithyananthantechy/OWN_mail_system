'use client';

import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function InboxPage() {
  return (
    <MailList
      folder="inbox"
      title="Inbox"
      queryKey="inbox"
      queryFn={(accountId, page) => mailApi.getInbox(accountId, page)}
    />
  );
}
