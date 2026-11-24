'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, RefreshCw, X } from 'lucide-react';
import { useAuthStore, useMailAccountStore } from '@/store/auth.store';
import { mailApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function TopBar() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedAccountId, accounts, setSelectedAccount } = useMailAccountStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/mail/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchRef.current?.focus();
  };

  return (
    <header className="h-14 bg-surface-900 border-b border-surface-800 flex items-center px-4 gap-4 flex-shrink-0">
      {/* Account selector */}
      {accounts.length > 1 && (
        <select
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="text-sm bg-surface-800 border border-surface-700 text-surface-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer max-w-[200px] truncate"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.emailAddress}
            </option>
          ))}
        </select>
      )}

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        className={`flex-1 max-w-xl relative transition-all duration-200 ${
          isSearchFocused ? 'max-w-2xl' : ''
        }`}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emails... (from: to: subject: is:unread)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="w-full pl-9 pr-8 py-2 bg-surface-800 border border-surface-700 hover:border-surface-600 focus:border-brand-500 text-surface-200 placeholder-surface-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-surface-500 hover:text-surface-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications placeholder */}
        <button className="btn-icon relative" title="Notifications">
          <Bell className="w-4 h-4" />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 ml-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <span className="text-sm text-surface-300 hidden md:block max-w-[120px] truncate">
            {user?.displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
