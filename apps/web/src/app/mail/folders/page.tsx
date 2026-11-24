'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FolderPlus, Folder, Trash2, Edit3, X, Plus,
  ChevronRight, ArrowLeft, Loader2
} from 'lucide-react';
import { foldersApi } from '@/lib/api';
import { useMailAccountStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface FolderItem {
  id: string;
  name: string;
  displayName: string;
  type: string;
  unreadCount?: number;
  totalCount?: number;
  children?: FolderItem[];
}

export default function FoldersManagementPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedAccountId } = useMailAccountStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['folders', selectedAccountId],
    queryFn: () => foldersApi.getFolders(selectedAccountId!),
    enabled: !!selectedAccountId,
  });

  const allFolders: FolderItem[] = data?.data?.data || [];
  const systemFolders = allFolders.filter((f) => f.type !== 'CUSTOM');
  const customFolders = allFolders.filter((f) => f.type === 'CUSTOM');

  const createMutation = useMutation({
    mutationFn: () => foldersApi.createFolder(selectedAccountId!, newFolderName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Folder created successfully.');
      closeModal();
    },
    onError: () => toast.error('Failed to create folder.'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      foldersApi.renameFolder(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Folder renamed.');
      closeModal();
    },
    onError: () => toast.error('Failed to rename folder.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => foldersApi.deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Folder deleted.');
    },
    onError: () => toast.error('Failed to delete folder.'),
  });

  const openCreateModal = () => {
    setEditingFolder(null);
    setNewFolderName('');
    setModalOpen(true);
  };

  const openEditModal = (f: FolderItem) => {
    setEditingFolder(f);
    setNewFolderName(f.displayName || f.name);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingFolder(null);
    setNewFolderName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    if (editingFolder) {
      renameMutation.mutate({ id: editingFolder.id, name: newFolderName.trim() });
    } else {
      createMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-950">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-900">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-icon">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-surface-100">Folder Management</h1>
            <p className="text-xs text-surface-500">Organize and structure your mailboxes</p>
          </div>
        </div>

        <button onClick={openCreateModal} className="btn-primary text-xs py-2">
          <Plus className="w-3.5 h-3.5" />
          New Folder
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6">
        {/* Custom Folders Section */}
        <div>
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
            Custom Folders ({customFolders.length})
          </h2>

          {customFolders.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Folder className="w-12 h-12 text-surface-700 mx-auto mb-2" />
              <p className="text-surface-400 text-sm font-medium">No custom folders created yet</p>
              <p className="text-surface-600 text-xs mt-1">Create folders to categorize projects, clients, or tags</p>
              <button onClick={openCreateModal} className="btn-secondary text-xs mt-4">
                <Plus className="w-3.5 h-3.5" />
                Create Folder
              </button>
            </div>
          ) : (
            <div className="glass-card divide-y divide-surface-800">
              {customFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-800/40 transition-colors"
                >
                  <Link
                    href={`/mail/folder/${folder.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <Folder className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-surface-200 truncate">
                      {folder.displayName || folder.name}
                    </span>
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(folder)}
                      className="btn-icon"
                      title="Rename"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(folder.id)}
                      className="btn-icon text-red-400 hover:text-red-300"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Folders Section */}
        <div>
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">
            Default System Folders
          </h2>
          <div className="glass-card divide-y divide-surface-800 opacity-80">
            {systemFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-4 h-4 text-surface-500" />
                  <span className="text-sm text-surface-300">{folder.displayName || folder.name}</span>
                </div>
                <span className="badge badge-system text-[10px]">Protected</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm glass-card bg-surface-900 border border-surface-700 p-6 shadow-2xl rounded-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-surface-800">
              <h3 className="text-sm font-semibold text-surface-100">
                {editingFolder ? 'Rename Folder' : 'Create New Folder'}
              </h3>
              <button onClick={closeModal} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Clients, Invoices, Work"
                  className="input-field text-xs w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || renameMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {(createMutation.isPending || renameMutation.isPending) && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editingFolder ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
