'use client';

import { useParams } from 'next/navigation';
import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function FolderPage() {
  const params = useParams();
  const folderId = params?.id as string;

  return (
    <MailList
      folder={`folder/${folderId}`}
      title="Custom Folder"
      queryKey={`folder-${folderId}`}
      queryFn={(accountId, page) => mailApi.getFolder(folderId, accountId, page)}
    />
  );
}
