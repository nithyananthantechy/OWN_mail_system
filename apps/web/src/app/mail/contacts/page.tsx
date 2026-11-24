'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Search, Mail, Phone, Building,
  Trash2, Edit3, X, Check, Loader2, MoreVertical
} from 'lucide-react';
import { contactsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Contact {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
}

export default function ContactsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => contactsApi.getContacts(search || undefined),
  });

  const contacts: Contact[] = data?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (newContact: typeof formData) => contactsApi.createContact(newContact),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created successfully.');
      closeModal();
    },
    onError: () => toast.error('Failed to create contact.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      contactsApi.updateContact(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact updated successfully.');
      closeModal();
    },
    onError: () => toast.error('Failed to update contact.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted.');
    },
    onError: () => toast.error('Failed to delete contact.'),
  });

  const openCreateModal = () => {
    setEditingContact(null);
    setFormData({
      displayName: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (c: Contact) => {
    setEditingContact(c);
    setFormData({
      displayName: c.displayName || '',
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingContact(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('Email is required.');
      return;
    }
    const finalDisplayName =
      formData.displayName ||
      `${formData.firstName} ${formData.lastName}`.trim() ||
      formData.email;

    const payload = { ...formData, displayName: finalDisplayName };

    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleComposeTo = (email: string) => {
    router.push(`/mail/compose?to=${encodeURIComponent(email)}`);
  };

  return (
    <div className="flex flex-col h-full bg-surface-950">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-900">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-surface-100">Contacts</h1>
            <p className="text-xs text-surface-500">{contacts.length} total contact{contacts.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full bg-surface-800/80 border border-surface-700/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-surface-200 placeholder-surface-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <button onClick={openCreateModal} className="btn-primary text-xs py-2">
            <UserPlus className="w-3.5 h-3.5" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Contacts List Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-2.5 w-1/2 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <Users className="w-16 h-16 text-surface-800 mb-3" />
            <p className="text-surface-400 font-medium">No contacts found</p>
            <p className="text-surface-600 text-xs mt-1">Add your frequent correspondents for quick access</p>
            <button onClick={openCreateModal} className="btn-secondary text-xs mt-4">
              <UserPlus className="w-3.5 h-3.5" />
              Add First Contact
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {contacts.map((contact) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card p-4 flex flex-col justify-between group hover:border-surface-700 transition-all shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-700 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm shadow-md">
                        {contact.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-surface-100 truncate">
                          {contact.displayName}
                        </h3>
                        {contact.company && (
                          <div className="flex items-center gap-1 text-xs text-surface-400 truncate mt-0.5">
                            <Building className="w-3 h-3 text-surface-500 flex-shrink-0" />
                            <span className="truncate">{contact.company}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(contact)}
                        className="p-1 hover:bg-surface-700 rounded text-surface-400 hover:text-surface-200"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(contact.id)}
                        className="p-1 hover:bg-surface-700 rounded text-surface-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-surface-800/80 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-surface-300">
                      <Mail className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
                      <span className="truncate flex-1">{contact.email}</span>
                      <button
                        onClick={() => handleComposeTo(contact.email)}
                        className="text-brand-400 hover:text-brand-300 text-xs font-medium ml-1"
                        title="Send email"
                      >
                        Send
                      </button>
                    </div>

                    {contact.phone && (
                      <div className="flex items-center gap-2 text-surface-400">
                        <Phone className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
                        <span className="truncate">{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass-card bg-surface-900 border border-surface-700 p-6 shadow-2xl rounded-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-surface-800">
              <h2 className="text-base font-semibold text-surface-100">
                {editingContact ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button onClick={closeModal} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  Full / Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="input-field text-xs w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input-field text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input-field text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Company / Org</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="NITECHSPARK"
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="input-field text-xs w-full resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-800">
                <button type="button" onClick={closeModal} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editingContact ? 'Save Changes' : 'Create Contact'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
