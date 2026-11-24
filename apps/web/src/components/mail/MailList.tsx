'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Star, Paperclip, Trash2, Archive, RefreshCw,
  ChevronLeft, ChevronRight, Check, MoreHorizontal,
  AlertCircle, Loader2, MailOpen, Mail as MailIcon
} from 'lucide-react';
import { mailApi } from '@/lib/api';
import { useMailAccountStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

function formatEmailDate(date: string | Date) {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

interface EmailItem {
  id: string;
  fromAddress: { name?: string; address: string };
  subject: string;
  preview: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
}

interface MailListProps {
  folder?: string;
  title?: string;
  queryFn: (accountId: string, page: number) => Promise<{ data: { data: { emails: EmailItem[]; total: number; totalPages: number } } }>;
  queryKey: string;
}

export function MailList({ folder = 'inbox', title = 'Inbox', queryFn, queryKey }: MailListProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedAccountId } = useMailAccountStore();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [queryKey, selectedAccountId, page],
    queryFn: () => queryFn(selectedAccountId!, page),
    enabled: !!selectedAccountId,
    refetchInterval: 60000, // auto-refresh every minute
  });

  const emails: EmailItem[] = data?.data?.data?.emails || [];
  const total = data?.data?.data?.total || 0;
  const totalPages = data?.data?.data?.totalPages || 1;

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => mailApi.bulkRead(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); setSelectedIds(new Set()); },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => mailApi.bulkDelete(ids),
    onSuccess: () => {
      toast.success(`${selectedIds.size} email(s) deleted.`);
      qc.invalidateQueries({ queryKey: [queryKey] });
      setSelectedIds(new Set());
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await mailApi.archive(id); },
    onSuccess: () => {
      toast.success('Archived.');
      qc.invalidateQueries({ queryKey: [queryKey] });
      setSelectedIds(new Set());
    },
  });

  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      starred ? mailApi.unstar(id) : mailApi.star(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
      setSelectAll(true);
    }
  };

  const openEmail = (email: EmailItem) => {
    router.push(`/mail/message/${email.id}`);
  };

  if (!selectedAccountId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MailIcon className="w-12 h-12 text-surface-700 mx-auto mb-3" />
          <p className="text-surface-500">No mail account configured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <button
          onClick={toggleSelectAll}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            selectAll
              ? 'bg-brand-600 border-brand-600'
              : 'border-surface-600 hover:border-surface-400'
          }`}
        >
          {selectAll && <Check className="w-3 h-3 text-white" />}
        </button>

        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-surface-400 mr-1">{selectedIds.size} selected</span>
            <button
              onClick={() => markReadMutation.mutate([...selectedIds])}
              className="btn-ghost text-xs"
            >
              <MailOpen className="w-3.5 h-3.5" />
              Mark read
            </button>
            <button
              onClick={() => archiveMutation.mutate([...selectedIds])}
              className="btn-ghost text-xs"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
            <button
              onClick={() => deleteMutation.mutate([...selectedIds])}
              className="btn-ghost text-xs text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-surface-200">{title}</h1>
            {total > 0 && (
              <span className="badge badge-unread">{total}</span>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-icon"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          {/* Pagination */}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-surface-500">{total > 0 ? `${(page-1)*50+1}-${Math.min(page*50, total)} of ${total}` : '0'}</span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-icon disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-icon disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto mail-list-scroll">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-surface-800">
                <div className="skeleton w-4 h-4 rounded mt-1" />
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-1/3 rounded" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                  <div className="skeleton h-2.5 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <MailIcon className="w-16 h-16 text-surface-800 mb-4" />
            <p className="text-surface-500 font-medium">No emails in {title}</p>
            <p className="text-surface-600 text-sm mt-1">New messages will appear here</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {emails.map((email, i) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ delay: i * 0.02, duration: 0.15 }}
                className={`${email.isRead ? 'mail-item' : 'mail-item-unread'} ${
                  selectedIds.has(email.id) ? 'bg-brand-600/5' : ''
                }`}
                onClick={() => openEmail(email)}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => { e.stopPropagation(); toggleSelect(email.id); }}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer transition-all ${
                    selectedIds.has(email.id)
                      ? 'bg-brand-600 border-brand-600'
                      : 'border-surface-700 hover:border-surface-500'
                  }`}
                >
                  {selectedIds.has(email.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-white">
                    {(email.fromAddress.name || email.fromAddress.address).charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm truncate ${email.isRead ? 'text-surface-300 font-normal' : 'text-surface-100 font-semibold'}`}>
                      {email.fromAddress.name || email.fromAddress.address}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {email.hasAttachments && <Paperclip className="w-3 h-3 text-surface-500" />}
                      <span className="text-xs text-surface-500">{formatEmailDate(email.date)}</span>
                    </div>
                  </div>
                  <p className={`text-sm truncate ${email.isRead ? 'text-surface-400' : 'text-surface-200'}`}>
                    {email.subject}
                  </p>
                  <p className="text-xs text-surface-600 truncate">{email.preview}</p>
                </div>

                {/* Star */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    starMutation.mutate({ id: email.id, starred: email.isStarred });
                  }}
                  className={`flex-shrink-0 p-1 rounded transition-colors ${
                    email.isStarred
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-surface-700 hover:text-surface-500 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star className={`w-4 h-4 ${email.isStarred ? 'fill-current' : ''}`} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
