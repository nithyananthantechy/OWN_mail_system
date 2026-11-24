'use client';

import { useSearchParams } from 'next/navigation';
import { mailApi } from '@/lib/api';
import { MailList } from '@/components/mail/MailList';

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  return (
    <MailList
      folder="search"
      title={query ? `Search: "${query}"` : 'Search Results'}
      queryKey={`search-${query}`}
      queryFn={(accountId, page) =>
        mailApi.search({ accountId, q: query, page, limit: 50 })
      }
    />
  );
}
