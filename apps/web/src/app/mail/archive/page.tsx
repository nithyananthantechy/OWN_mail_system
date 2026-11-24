'use client';

import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function ArchivePage() {
  return (
    <MailList
      folder="archive"
      title="Archive"
      queryKey="archive"
      queryFn={(accountId, page) => mailApi.getFolder('ARCHIVE', accountId, page)}
    />
  );
}
