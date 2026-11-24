'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Settings, User, Key, Bell, Palette, FileSignature,
  Plus, Trash2, Edit3, Check, Save, Loader2
} from 'lucide-react';
import { settingsApi, authApi } from '@/lib/api';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Key },
  { id: 'signatures', label: 'Signatures', icon: FileSignature },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  const { data: signaturesData } = useQuery({
    queryKey: ['signatures'],
    queryFn: settingsApi.getSignatures,
  });

  const settings = settingsData?.data?.data;
  const signatures = signaturesData?.data?.data || [];

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => settingsApi.updateSettings(data),
    onSuccess: () => {
      toast.success('Settings saved.');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => toast.error('Failed to save settings.'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password changed. Please log in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to change password.');
    },
  });

  const deleteSignatureMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteSignature(id),
    onSuccess: () => {
      toast.success('Signature deleted.');
      qc.invalidateQueries({ queryKey: ['signatures'] });
    },
  });

  return (
    <div className="flex h-full bg-surface-950">
      {/* Settings Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-surface-800 bg-surface-900 py-4">
        <h2 className="px-4 text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Settings</h2>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left ${activeTab === tab.id ? 'nav-item-active' : 'nav-item'} mx-1`}
              style={{ width: 'calc(100% - 8px)' }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">

          {/* General */}
          {activeTab === 'general' && settings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-lg font-semibold text-surface-100 mb-6">General Settings</h1>
              <div className="glass-card p-6 space-y-5">
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Theme</label>
                  <select
                    defaultValue={settings.theme || 'dark'}
                    className="input-field"
                    onChange={(e) => updateSettingsMutation.mutate({ theme: e.target.value })}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Timezone</label>
                  <select
                    defaultValue={settings.timezone || 'Asia/Kolkata'}
                    className="input-field"
                    onChange={(e) => updateSettingsMutation.mutate({ timezone: e.target.value })}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>

                {/* Emails per page */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Emails per page</label>
                  <select
                    defaultValue={settings.emailsPerPage || 50}
                    className="input-field"
                    onChange={(e) => updateSettingsMutation.mutate({ emailsPerPage: +e.target.value })}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* HTML emails */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-300">Show HTML emails</p>
                    <p className="text-xs text-surface-500">Display rich formatted emails</p>
                  </div>
                  <button
                    onClick={() => updateSettingsMutation.mutate({ showHtmlEmails: !settings.showHtmlEmails })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${settings.showHtmlEmails ? 'bg-brand-600' : 'bg-surface-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.showHtmlEmails ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-lg font-semibold text-surface-100 mb-6">Security</h1>
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-surface-200 mb-4">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field"
                    />
                    <p className="text-xs text-surface-500 mt-1">Min 12 chars, uppercase, lowercase, number, special char</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (newPassword !== confirmPassword) {
                        toast.error('Passwords do not match.');
                        return;
                      }
                      changePasswordMutation.mutate();
                    }}
                    disabled={changePasswordMutation.isPending || !currentPassword || !newPassword}
                    className="btn-primary"
                  >
                    {changePasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Change Password
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Signatures */}
          {activeTab === 'signatures' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold text-surface-100">Email Signatures</h1>
              </div>

              {signatures.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <FileSignature className="w-10 h-10 text-surface-700 mx-auto mb-3" />
                  <p className="text-surface-500 mb-4">No signatures yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {signatures.map((sig: { id: string; name: string; content: string; isDefault: boolean; isHtml: boolean }) => (
                    <div key={sig.id} className="glass-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-surface-200">{sig.name}</span>
                            {sig.isDefault && (
                              <span className="badge bg-brand-600/20 text-brand-400 text-xs">Default</span>
                            )}
                            {sig.isHtml && (
                              <span className="badge bg-surface-700 text-surface-400 text-xs">HTML</span>
                            )}
                          </div>
                          <div
                            className="text-xs text-surface-400 line-clamp-2"
                            dangerouslySetInnerHTML={sig.isHtml ? { __html: sig.content } : undefined}
                          >
                            {!sig.isHtml && sig.content}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteSignatureMutation.mutate(sig.id)}
                          className="btn-icon text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Other tabs placeholder */}
          {(activeTab === 'profile' || activeTab === 'notifications') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-lg font-semibold text-surface-100 mb-6 capitalize">{activeTab}</h1>
              <div className="glass-card p-6">
                <p className="text-surface-400 text-sm">This section is under development.</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
