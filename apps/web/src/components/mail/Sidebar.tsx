'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, Star, Send, FileText, AlertTriangle, Trash2, Archive,
  Plus, Settings, ChevronDown, ChevronRight, Mail, Shield,
  FolderPlus, Users, LogOut, User, BarChart3, Moon, Sun
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { foldersApi } from '@/lib/api';
import { useAuthStore, useMailAccountStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

const SYSTEM_FOLDERS = [
  { type: 'INBOX', label: 'Inbox', icon: Inbox, href: '/mail/inbox', color: 'text-brand-400' },
  { type: 'STARRED', label: 'Starred', icon: Star, href: '/mail/starred', color: 'text-amber-400' },
  { type: 'SENT', label: 'Sent', icon: Send, href: '/mail/sent', color: 'text-surface-400' },
  { type: 'DRAFTS', label: 'Drafts', icon: FileText, href: '/mail/drafts', color: 'text-surface-400' },
  { type: 'SPAM', label: 'Spam', icon: AlertTriangle, href: '/mail/spam', color: 'text-amber-500' },
  { type: 'TRASH', label: 'Trash', icon: Trash2, href: '/mail/trash', color: 'text-red-400' },
  { type: 'ARCHIVE', label: 'Archive', icon: Archive, href: '/mail/archive', color: 'text-surface-400' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { selectedAccountId } = useMailAccountStore();
  const [customExpanded, setCustomExpanded] = useState(true);

  const { data: foldersData } = useQuery({
    queryKey: ['folders', selectedAccountId],
    queryFn: () => foldersApi.getFolders(selectedAccountId!),
    enabled: !!selectedAccountId,
  });

  const customFolders = foldersData?.data?.data?.filter((f: { type: string }) => f.type === 'CUSTOM') || [];

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    logout();
    router.replace('/login');
    toast.success('Logged out successfully.');
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-900 border-r border-surface-800 flex flex-col h-full">
      {/* Brand Logo */}
      <div className="px-4 py-4 border-b border-surface-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center flex-shrink-0 shadow-glow-brand">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gradient-brand truncate">NITECHSPARK</p>
            <p className="text-xs text-surface-500 truncate">Mail Platform</p>
          </div>
        </div>
      </div>

      {/* Compose Button */}
      <div className="px-3 py-3 border-b border-surface-800">
        <Link
          href="/mail/compose"
          className="btn-primary w-full justify-center text-sm py-2.5"
        >
          <Plus className="w-4 h-4" />
          Compose
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {/* System Folders */}
        {SYSTEM_FOLDERS.map((folder) => {
          const isActive = pathname === folder.href || pathname.startsWith(folder.href + '/');
          const Icon = folder.icon;
          return (
            <Link
              key={folder.type}
              href={folder.href}
              className={isActive ? 'nav-item-active' : 'nav-item'}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-400' : folder.color}`} />
              <span className="flex-1 truncate">{folder.label}</span>
              {/* Unread count would go here */}
            </Link>
          );
        })}

        {/* Custom Folders */}
        <div className="pt-2">
          <button
            onClick={() => setCustomExpanded((v) => !v)}
            className="nav-item w-full justify-between group"
          >
            <div className="flex items-center gap-3">
              <FolderPlus className="w-4 h-4 text-surface-500" />
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Folders</span>
            </div>
            {customExpanded ? (
              <ChevronDown className="w-3 h-3 text-surface-600" />
            ) : (
              <ChevronRight className="w-3 h-3 text-surface-600" />
            )}
          </button>

          <AnimatePresence>
            {customExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                {customFolders.map((folder: { id: string; displayName: string }) => (
                  <Link
                    key={folder.id}
                    href={`/mail/folder/${folder.id}`}
                    className={pathname.includes(folder.id) ? 'nav-item-active' : 'nav-item'}
                  >
                    <span className="w-4 h-4 flex-shrink-0 text-center text-surface-500">#</span>
                    <span className="flex-1 truncate text-sm">{folder.displayName}</span>
                  </Link>
                ))}
                <Link href="/mail/folders" className="nav-item text-xs text-surface-600 hover:text-surface-400">
                  <Plus className="w-3 h-3" />
                  New folder
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Admin Link */}
        {user?.role === 'ADMIN' && (
          <div className="pt-2 border-t border-surface-800 mt-2">
            <Link
              href="/admin"
              className={pathname.startsWith('/admin') ? 'nav-item-active' : 'nav-item'}
            >
              <Shield className="w-4 h-4 text-cyber-400" />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-surface-800">
        {/* Links */}
        <div className="px-2 py-2 space-y-0.5">
          <Link href="/mail/contacts" className={pathname.startsWith('/mail/contacts') ? 'nav-item-active' : 'nav-item'}>
            <Users className="w-4 h-4" />
            Contacts
          </Link>
          <Link href="/mail/settings" className={pathname.startsWith('/mail/settings') ? 'nav-item-active' : 'nav-item'}>
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>

        {/* User info */}
        <div className="px-3 py-3 border-t border-surface-800">
          <div className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-200 truncate">{user?.displayName}</p>
              <p className="text-xs text-surface-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="btn-icon opacity-0 group-hover:opacity-100 transition-opacity"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
