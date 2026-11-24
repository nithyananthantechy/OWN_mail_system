'use client';

import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function DraftsPage() {
  return (
    <MailList
      folder="drafts"
      title="Drafts"
      queryKey="drafts"
      queryFn={(accountId, page) => mailApi.getFolder('DRAFTS', accountId, page)}
    />
  );
}
