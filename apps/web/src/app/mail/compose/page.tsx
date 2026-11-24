'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  X, Minus, Maximize2, Send, Paperclip, Trash2,
  Bold, Italic, Underline, List, Link2, ChevronDown,
  Loader2, Save, AlertCircle, Type, AlignLeft
} from 'lucide-react';
import { mailApi, settingsApi } from '@/lib/api';
import { useMailAccountStore } from '@/store/auth.store';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface ComposeState {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: File[];
  isHtml: boolean;
  showCc: boolean;
  showBcc: boolean;
  draftId?: string;
  isSaving: boolean;
  lastSaved?: Date;
}

const AUTO_SAVE_DELAY = 30000; // 30 seconds

export default function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedAccountId } = useMailAccountStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<ComposeState>({
    to: searchParams?.get('to') || '',
    cc: '',
    bcc: '',
    subject: searchParams?.get('subject') || '',
    body: '',
    attachments: [],
    isHtml: false,
    showCc: false,
    showBcc: false,
    isSaving: false,
  });

  // Fetch signatures
  const { data: signaturesData } = useQuery({
    queryKey: ['signatures'],
    queryFn: settingsApi.getSignatures,
  });

  const defaultSignature = signaturesData?.data?.data?.find((s: { isDefault: boolean }) => s.isDefault);

  useEffect(() => {
    if (defaultSignature) {
      setState((prev) => ({
        ...prev,
        body: prev.body || `\n\n--\n${defaultSignature.content}`,
      }));
    }
  }, [defaultSignature]);

  const update = (field: keyof ComposeState, value: unknown) =>
    setState((prev) => ({ ...prev, [field]: value }));

  // Auto-save draft
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId || (!state.to && !state.subject && !state.body)) return;
      const data = {
        mailAccountId: selectedAccountId,
        to: state.to ? state.to.split(',').map((e) => e.trim()).filter(Boolean) : [],
        cc: state.cc ? state.cc.split(',').map((e) => e.trim()).filter(Boolean) : [],
        subject: state.subject,
        bodyText: state.isHtml ? undefined : state.body,
        bodyHtml: state.isHtml ? state.body : undefined,
        isDraft: true,
      };
      return state.draftId ? mailApi.updateDraft(state.draftId, data) : mailApi.saveDraft(data);
    },
    onSuccess: (result) => {
      if (result?.data?.data?.id && !state.draftId) {
        setState((prev) => ({ ...prev, draftId: result.data.data.id, lastSaved: new Date(), isSaving: false }));
      } else {
        setState((prev) => ({ ...prev, lastSaved: new Date(), isSaving: false }));
      }
    },
    onError: () => setState((prev) => ({ ...prev, isSaving: false })),
  });

  // Debounced auto-save
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setState((prev) => ({ ...prev, isSaving: true }));
    saveTimerRef.current = setTimeout(() => {
      saveDraftMutation.mutate();
    }, AUTO_SAVE_DELAY);
  }, [saveDraftMutation]);

  useEffect(() => {
    scheduleSave();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state.to, state.subject, state.body]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) throw new Error('No mail account selected.');
      if (!state.to.trim()) throw new Error('Please add at least one recipient.');
      if (!state.subject.trim() && !state.body.trim()) throw new Error('Email is empty.');

      return mailApi.sendEmail({
        mailAccountId: selectedAccountId,
        to: state.to.split(',').map((e) => e.trim()).filter(Boolean),
        cc: state.cc ? state.cc.split(',').map((e) => e.trim()).filter(Boolean) : [],
        bcc: state.bcc ? state.bcc.split(',').map((e) => e.trim()).filter(Boolean) : [],
        subject: state.subject || '(No Subject)',
        bodyText: state.isHtml ? undefined : state.body,
        bodyHtml: state.isHtml ? state.body : undefined,
      });
    },
    onSuccess: () => {
      toast.success('Email sent successfully!');
      router.back();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = e?.response?.data?.error?.message || 'Failed to send email.';
      toast.error(msg);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    const valid = files.filter((f) => {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} exceeds 25MB limit.`);
        return false;
      }
      return true;
    });
    setState((prev) => ({ ...prev, attachments: [...prev.attachments, ...valid] }));
  };

  const removeAttachment = (index: number) =>
    setState((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));

  const totalAttachmentSize = state.attachments.reduce((acc, f) => acc + f.size, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full bg-surface-950"
    >
      {/* Compose Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <h1 className="text-sm font-semibold text-surface-200">New Message</h1>
        <div className="flex items-center gap-2">
          {/* Draft status */}
          <span className="text-xs text-surface-600">
            {state.isSaving ? 'Saving...' : state.lastSaved ? `Saved ${state.lastSaved.toLocaleTimeString()}` : ''}
          </span>
          <button onClick={() => router.back()} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compose Form */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Recipients */}
        <div className="border-b border-surface-800 divide-y divide-surface-800/50">
          {/* To */}
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="text-xs font-medium text-surface-500 w-8">To</span>
            <input
              type="text"
              value={state.to}
              onChange={(e) => update('to', e.target.value)}
              placeholder="recipient@example.com, another@example.com"
              className="flex-1 bg-transparent text-sm text-surface-200 placeholder-surface-600 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              {!state.showCc && (
                <button onClick={() => update('showCc', true)} className="text-xs text-surface-500 hover:text-surface-300">CC</button>
              )}
              {!state.showBcc && (
                <button onClick={() => update('showBcc', true)} className="text-xs text-surface-500 hover:text-surface-300">BCC</button>
              )}
            </div>
          </div>

          {/* CC */}
          {state.showCc && (
            <div className="flex items-center gap-3 px-4 py-2">
              <span className="text-xs font-medium text-surface-500 w-8">CC</span>
              <input
                type="text"
                value={state.cc}
                onChange={(e) => update('cc', e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 bg-transparent text-sm text-surface-200 placeholder-surface-600 focus:outline-none"
              />
            </div>
          )}

          {/* BCC */}
          {state.showBcc && (
            <div className="flex items-center gap-3 px-4 py-2">
              <span className="text-xs font-medium text-surface-500 w-8">BCC</span>
              <input
                type="text"
                value={state.bcc}
                onChange={(e) => update('bcc', e.target.value)}
                placeholder="bcc@example.com"
                className="flex-1 bg-transparent text-sm text-surface-200 placeholder-surface-600 focus:outline-none"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="text-xs font-medium text-surface-500 w-8">Subj</span>
            <input
              type="text"
              value={state.subject}
              onChange={(e) => update('subject', e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-transparent text-sm font-medium text-surface-200 placeholder-surface-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center gap-0.5 px-4 py-2 border-b border-surface-800 bg-surface-900/50">
          <button
            onClick={() => update('isHtml', !state.isHtml)}
            className={`toolbar-btn text-xs px-2 ${state.isHtml ? 'bg-brand-600/20 text-brand-400' : ''}`}
            title="Toggle HTML mode"
          >
            {state.isHtml ? 'HTML' : 'Plain'}
          </button>
          <div className="w-px h-4 bg-surface-700 mx-1" />
          <button className="toolbar-btn" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
          <button className="toolbar-btn" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
          <button className="toolbar-btn" title="Underline"><Underline className="w-3.5 h-3.5" /></button>
          <button className="toolbar-btn" title="List"><List className="w-3.5 h-3.5" /></button>
          <button className="toolbar-btn" title="Link"><Link2 className="w-3.5 h-3.5" /></button>
        </div>

        {/* Message body */}
        <div className="flex-1 overflow-hidden">
          <textarea
            value={state.body}
            onChange={(e) => update('body', e.target.value)}
            placeholder="Write your message..."
            className="w-full h-full p-4 bg-transparent text-sm text-surface-200 placeholder-surface-600 focus:outline-none resize-none font-sans leading-relaxed"
          />
        </div>

        {/* Attachments list */}
        {state.attachments.length > 0 && (
          <div className="px-4 py-2 border-t border-surface-800 flex flex-wrap gap-2">
            {state.attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 rounded-lg text-xs">
                <Paperclip className="w-3 h-3 text-surface-400" />
                <span className="text-surface-300 max-w-[120px] truncate">{file.name}</span>
                <span className="text-surface-500">({(file.size / 1024).toFixed(0)}KB)</span>
                <button onClick={() => removeAttachment(i)} className="text-surface-500 hover:text-red-400 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-surface-800 bg-surface-900 flex-shrink-0">
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !state.to.trim()}
            className="btn-primary"
          >
            {sendMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
            ) : (
              <><Send className="w-4 h-4" />Send</>
            )}
          </button>

          {/* Attachment */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn-ghost">
            <Paperclip className="w-4 h-4" />
            Attach
          </button>

          <div className="ml-auto">
            <button onClick={() => router.back()} className="btn-ghost text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
              Discard
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
