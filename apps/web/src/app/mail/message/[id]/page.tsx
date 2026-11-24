'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  ArrowLeft, Reply, ReplyAll, Forward, Trash2, Archive,
  Star, AlertTriangle, Printer, Download, Paperclip,
  Loader2
} from 'lucide-react';
import { mailApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface EmailDetail {
  id: string;
  subject: string;
  fromAddress: { name?: string; address: string };
  toAddresses: Array<{ name?: string; address: string }>;
  ccAddresses: Array<{ name?: string; address: string }>;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  bodyHtml?: string;
  bodyText?: string;
  attachments?: Array<{ id: string; filename: string; size: number; mimeType: string }>;
  messageId?: string;
}

function formatAddresses(addrs: Array<{ name?: string; address: string }>) {
  return addrs.map((a) => a.name ? `${a.name} <${a.address}>` : a.address).join(', ');
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessageViewPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const emailId = params?.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['email', emailId],
    queryFn: () => mailApi.getEmail(emailId),
    enabled: !!emailId,
  });

  const email: EmailDetail | null = data?.data?.data || null;

  const starMutation = useMutation({
    mutationFn: () => email?.isStarred ? mailApi.unstar(emailId) : mailApi.star(emailId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email', emailId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => mailApi.delete(emailId),
    onSuccess: () => {
      toast.success('Email deleted.');
      router.back();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => mailApi.archive(emailId),
    onSuccess: () => {
      toast.success('Archived.');
      router.back();
    },
  });

  const handleReply = () => {
    if (!email) return;
    const searchParams = new URLSearchParams({
      to: email.fromAddress.address,
      subject: `Re: ${email.subject}`,
      inReplyTo: email.messageId || '',
      replyTo: emailId,
    });
    router.push(`/mail/compose?${searchParams.toString()}`);
  };

  const handleForward = () => {
    if (!email) return;
    const searchParams = new URLSearchParams({
      subject: `Fwd: ${email.subject}`,
      forwardFrom: emailId,
    });
    router.push(`/mail/compose?${searchParams.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="text-surface-400">Unable to load email. Please try again.</p>
        <button onClick={() => router.back()} className="btn-secondary text-sm">
          Go back
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full bg-surface-950"
    >
      {/* Email Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <button onClick={() => router.back()} className="btn-icon" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 ml-1">
          <button onClick={handleReply} className="btn-secondary text-xs" title="Reply">
            <Reply className="w-3.5 h-3.5" />
            Reply
          </button>
          <button onClick={handleReply} className="btn-ghost text-xs" title="Reply All">
            <ReplyAll className="w-3.5 h-3.5" />
            All
          </button>
          <button onClick={handleForward} className="btn-ghost text-xs" title="Forward">
            <Forward className="w-3.5 h-3.5" />
            Forward
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => starMutation.mutate()}
            className={`btn-icon ${email.isStarred ? 'text-amber-400' : ''}`}
            title={email.isStarred ? 'Unstar' : 'Star'}
          >
            <Star className={`w-4 h-4 ${email.isStarred ? 'fill-current' : ''}`} />
          </button>
          <button onClick={() => archiveMutation.mutate()} className="btn-icon" title="Archive">
            <Archive className="w-4 h-4" />
          </button>
          <button onClick={() => deleteMutation.mutate()} className="btn-icon text-red-400 hover:text-red-300" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => window.print()} className="btn-icon" title="Print">
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Subject */}
          <h1 className="text-xl font-semibold text-surface-100 mb-4 leading-tight">
            {email.subject}
          </h1>

          {/* Header Card */}
          <div className="glass-card p-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">
                    {(email.fromAddress.name || email.fromAddress.address).charAt(0).toUpperCase()}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-surface-100">
                      {email.fromAddress.name || email.fromAddress.address}
                    </span>
                    {email.fromAddress.name && (
                      <span className="text-xs text-surface-500">&lt;{email.fromAddress.address}&gt;</span>
                    )}
                  </div>
                  <div className="text-sm text-surface-400 mt-0.5">
                    <span>To: {formatAddresses(email.toAddresses)}</span>
                  </div>
                  {email.ccAddresses.length > 0 && (
                    <div className="text-sm text-surface-500 mt-0.5">
                      <span>CC: {formatAddresses(email.ccAddresses)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <span className="text-sm text-surface-400">
                  {format(new Date(email.date), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-surface-400 mb-2 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
              </h3>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg hover:border-surface-600 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-surface-400" />
                    <div>
                      <p className="text-xs font-medium text-surface-200 max-w-[160px] truncate">{att.filename}</p>
                      <p className="text-xs text-surface-500">{formatBytes(att.size)}</p>
                    </div>
                    <button className="text-brand-400 hover:text-brand-300 ml-1">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Body */}
          <div className="glass-card p-6">
            {email.bodyHtml ? (
              <div
                className="email-body sanitized-email"
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : email.bodyText ? (
              <pre className="email-body whitespace-pre-wrap font-sans text-sm">
                {email.bodyText}
              </pre>
            ) : (
              <p className="text-surface-500 italic text-sm">No message body.</p>
            )}
          </div>

          {/* Quick Reply */}
          <div className="mt-6 glass-card p-4">
            <button
              onClick={handleReply}
              className="flex items-center gap-2 w-full text-left text-surface-500 hover:text-surface-300 text-sm transition-colors group"
            >
              <Reply className="w-4 h-4 group-hover:text-brand-400 transition-colors" />
              <span>Click to reply to {email.fromAddress.name || email.fromAddress.address}...</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
