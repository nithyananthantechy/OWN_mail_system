'use client';

import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function StarredPage() {
  return (
    <MailList
      folder="starred"
      title="Starred"
      queryKey="starred"
      queryFn={(accountId, page) => mailApi.getStarred(accountId, page)}
    />
  );
}
