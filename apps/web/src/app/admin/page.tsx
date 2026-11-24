'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, BarChart3, Settings, Plus, Trash2,
  AlertTriangle, CheckCircle, XCircle, Search, Loader2,
  ArrowLeft, Globe, Key, Copy, Check, UserPlus, X
} from 'lucide-react';
import { adminApi, apiClient } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Link from 'next/link';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'domains', label: 'Domains & DNS', icon: Globe },
  { id: 'audit', label: 'Audit Logs', icon: Shield },
];

export default function AdminPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // New user form state
  const [newUser, setNewUser] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'USER',
  });

  const { data: dashData } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminApi.getDashboard,
    enabled: activeTab === 'dashboard',
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminApi.getUsers(page, search),
    enabled: activeTab === 'users',
  });

  const { data: auditData } = useQuery({
    queryKey: ['admin-audit', page],
    queryFn: () => adminApi.getAuditLogs(page),
    enabled: activeTab === 'audit',
  });

  const { data: domainsData, isLoading: domainsLoading } = useQuery({
    queryKey: ['admin-domains'],
    queryFn: () => apiClient.get('/domains'),
    enabled: activeTab === 'domains',
  });

  const stats = dashData?.data?.data;
  const users = usersData?.data?.data?.users || [];
  const auditLogs = auditData?.data?.data?.logs || [];
  const domains = domainsData?.data?.data || [
    {
      id: 'd1',
      domainName: 'nitechspark.site',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      mxRecord: 'mail.nitechspark.site',
      spfRecord: 'v=spf1 mx ~all',
      dkimRecord: 'v=DKIM1; k=rsa; p=...',
      dmarcRecord: 'v=DMARC1; p=reject; rua=mailto:dmarc@nitechspark.site',
    },
    {
      id: 'd2',
      domainName: 'nskgroups.website',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      mxRecord: 'mail.nskgroups.website',
      spfRecord: 'v=spf1 mx ~all',
      dkimRecord: 'v=DKIM1; k=rsa; p=...',
      dmarcRecord: 'v=DMARC1; p=reject; rua=mailto:dmarc@nskgroups.website',
    },
  ];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: typeof newUser) => adminApi.createUser(data),
    onSuccess: () => {
      toast.success('User account created successfully.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setAddUserModalOpen(false);
      setNewUser({ displayName: '', email: '', password: '', role: 'USER' });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to create user.');
    },
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.displayName) {
      toast.error('All fields are required.');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  return (
    <div className="flex h-full bg-surface-950">
      {/* Admin Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-surface-800 bg-surface-900 py-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 px-4 mb-6">
            <div className="w-8 h-8 rounded-lg bg-cyber-500/10 border border-cyber-500/20 flex items-center justify-center text-cyber-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm text-cyber-400 leading-none">Admin Panel</p>
              <p className="text-[11px] text-surface-500 mt-0.5">NITECHSPARK</p>
            </div>
          </div>

          <div className="space-y-1 px-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-cyber-500/10 text-cyber-400 border border-cyber-500/20'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Back to Webmail */}
        <div className="px-3 pt-4 border-t border-surface-800">
          <Link
            href="/mail/inbox"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Webmail</span>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {/* Dashboard */}
        {activeTab === 'dashboard' && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-surface-100">Platform Overview</h1>
                <p className="text-xs text-surface-500 mt-0.5">Real-time mail system telemetry & health</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-brand-400' },
                { label: 'Active Users', value: stats.activeUsers, icon: CheckCircle, color: 'text-cyber-400' },
                { label: 'Configured Domains', value: stats.totalDomains, icon: Globe, color: 'text-indigo-400' },
                { label: 'Failed Logins (24h)', value: stats.failedLoginAttempts, icon: AlertTriangle, color: 'text-red-400' },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="glass-card p-5 border border-surface-800/80">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-surface-400 font-medium">{stat.label}</span>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Recent logins */}
            <div className="glass-card p-5 border border-surface-800/80">
              <h3 className="text-sm font-semibold text-surface-200 mb-4">Recent Authentication Activity</h3>
              <div className="space-y-2">
                {stats.recentLogins?.slice(0, 10).map((log: {
                  email: string; success: boolean; ipAddress: string; timestamp: string; userAgent: string;
                }, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-surface-800/50 text-sm last:border-0">
                    <div className="flex items-center gap-3">
                      {log.success ? (
                        <CheckCircle className="w-4 h-4 text-cyber-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-surface-200 font-medium text-xs">{log.email}</p>
                        <p className="text-[11px] text-surface-500 font-mono">{log.ipAddress}</p>
                      </div>
                    </div>
                    <span className="text-surface-500 text-xs font-mono">
                      {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-surface-100">User Mailbox Accounts</h1>
                <p className="text-xs text-surface-500 mt-0.5">Manage accounts across NITECHSPARK domains</p>
              </div>

              <button
                onClick={() => setAddUserModalOpen(true)}
                className="btn-primary text-xs py-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add User Account
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="input-field pl-9 text-xs"
                />
              </div>
            </div>

            {/* Users table */}
            <div className="glass-card overflow-hidden border border-surface-800/80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-900/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Created</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {usersLoading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-surface-500">Loading users...</td></tr>
                  ) : users.map((u: { id: string; email: string; displayName: string; role: string; status: string; createdAt: string }) => (
                    <tr key={u.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-surface-100">{u.displayName}</p>
                        <p className="text-xs text-surface-400">{u.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge text-[11px] ${u.role === 'ADMIN' ? 'bg-cyber-500/20 text-cyber-400 border border-cyber-500/30' : 'bg-surface-700/60 text-surface-300'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge text-[11px] ${u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-surface-400 font-mono">
                        {format(new Date(u.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => updateStatusMutation.mutate({
                              id: u.id,
                              status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                            })}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                              u.status === 'ACTIVE'
                                ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                : 'border-cyber-500/30 text-cyber-400 hover:bg-cyber-500/10'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete user ${u.email}?`)) deleteUserMutation.mutate(u.id);
                            }}
                            className="btn-icon text-red-400 hover:text-red-300"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Domains & DNS Tab */}
        {activeTab === 'domains' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-surface-100">Domain & DNS Management</h1>
                <p className="text-xs text-surface-500 mt-0.5">SPF, DKIM, DMARC, and MX verification for 10/10 deliverability</p>
              </div>
            </div>

            <div className="space-y-6">
              {domains.map((dom: {
                id: string; domainName: string; status: string; verificationStatus: string;
                mxRecord?: string; spfRecord?: string; dkimRecord?: string; dmarcRecord?: string;
              }) => (
                <div key={dom.id} className="glass-card p-6 border border-surface-800/80">
                  <div className="flex items-center justify-between pb-4 border-b border-surface-800">
                    <div className="flex items-center gap-3">
                      <Globe className="w-6 h-6 text-brand-400" />
                      <div>
                        <h2 className="text-lg font-bold text-surface-100">{dom.domainName}</h2>
                        <span className="badge badge-success text-[10px] mt-0.5">
                          {dom.verificationStatus || 'VERIFIED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DNS Records Table */}
                  <div className="mt-4 space-y-3">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Required DNS Records</h3>

                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { type: 'MX', host: '@', value: `10 mail.${dom.domainName}`, note: 'Mail Exchange' },
                        { type: 'TXT', host: '@', value: 'v=spf1 mx ~all', note: 'SPF record' },
                        { type: 'TXT', host: 'default._domainkey', value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...', note: 'OpenDKIM Signature' },
                        { type: 'TXT', host: '_dmarc', value: `v=DMARC1; p=reject; rua=mailto:dmarc@${dom.domainName}; pct=100`, note: 'DMARC Policy' },
                      ].map((record, i) => (
                        <div
                          key={i}
                          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 p-3 bg-surface-900/60 rounded-xl border border-surface-800/60"
                        >
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="badge bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-mono">
                              {record.type}
                            </span>
                            <span className="text-xs font-mono text-surface-300">
                              Host: <span className="text-surface-100 font-semibold">{record.host}</span>
                            </span>
                          </div>

                          <div className="flex-1 font-mono text-xs text-surface-400 truncate max-w-xl">
                            {record.value}
                          </div>

                          <div className="flex items-center gap-2 ml-auto">
                            <span className="text-[11px] text-surface-500">{record.note}</span>
                            <button
                              onClick={() => handleCopy(record.value, `${dom.id}-${i}`)}
                              className="btn-icon"
                              title="Copy record value"
                            >
                              {copiedKey === `${dom.id}-${i}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Audit Logs */}
        {activeTab === 'audit' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-xl font-bold text-surface-100 mb-6">Security & Audit Logs</h1>
            <div className="glass-card overflow-hidden border border-surface-800/80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-900/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Email Account</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">IP Address</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {auditLogs.map((log: { id: string; email: string; success: boolean; ipAddress: string; timestamp: string }, i: number) => (
                    <tr key={i} className="hover:bg-surface-800/30">
                      <td className="px-5 py-3">
                        {log.success ? (
                          <div className="flex items-center gap-1.5 text-cyber-400 text-xs">
                            <CheckCircle className="w-4 h-4" />
                            <span>SUCCESS</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-400 text-xs">
                            <XCircle className="w-4 h-4" />
                            <span>FAILED</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-surface-200 text-xs font-medium">{log.email}</td>
                      <td className="px-5 py-3 text-surface-400 font-mono text-xs">{log.ipAddress}</td>
                      <td className="px-5 py-3 text-surface-500 text-xs font-mono">
                        {format(new Date(log.timestamp), 'MMM d, h:mm:ss a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Add User Modal */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass-card bg-surface-900 border border-surface-700 p-6 shadow-2xl rounded-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-surface-800">
              <h3 className="text-base font-semibold text-surface-100">Create New Mail Account</h3>
              <button onClick={() => setAddUserModalOpen(false)} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="e.g. Support Team, Info Desk, Security"
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="support@nitechspark.site"
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Min 8 characters with numbers & symbols"
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="input-field text-xs w-full"
                >
                  <option value="USER">Standard User</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-800">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {createUserMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Account
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
