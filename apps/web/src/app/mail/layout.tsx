'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/mail/Sidebar';
import { TopBar } from '@/components/mail/TopBar';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useMailAccountStore } from '@/store/auth.store';

export default function MailLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { setAccounts } = useMailAccountStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  const { data: accountsData } = useQuery({
    queryKey: ['mailAccounts'],
    queryFn: () => usersApi.getMailAccounts(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (accountsData?.data?.data) {
      setAccounts(accountsData.data.data);
    }
  }, [accountsData, setAccounts]);

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col bg-surface-950 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
