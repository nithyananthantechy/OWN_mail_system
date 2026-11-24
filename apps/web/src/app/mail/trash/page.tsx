'use client';

import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function TrashPage() {
  return (
    <MailList
      folder="trash"
      title="Trash"
      queryKey="trash"
      queryFn={(accountId, page) => mailApi.getFolder('TRASH', accountId, page)}
    />
  );
}
