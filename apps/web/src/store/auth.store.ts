import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, accessToken: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: (user, accessToken) => {
        // Store token in sessionStorage (not localStorage for security)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('_at', accessToken);
        }
        set({ user, accessToken, isAuthenticated: true });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('_at');
        }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setAccessToken: (token) => {
        if (typeof window !== 'undefined') sessionStorage.setItem('_at', token);
        set({ accessToken: token, isAuthenticated: true });
      },
    }),
    {
      name: 'nitechspark-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);

// ---- Mail Account Store ----
interface MailAccountState {
  selectedAccountId: string | null;
  accounts: Array<{ id: string; emailAddress: string; displayName?: string }>;
  setSelectedAccount: (id: string) => void;
  setAccounts: (accounts: Array<{ id: string; emailAddress: string; displayName?: string }>) => void;
}

export const useMailAccountStore = create<MailAccountState>((set) => ({
  selectedAccountId: null,
  accounts: [],
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  setAccounts: (accounts) =>
    set((state) => ({
      accounts,
      selectedAccountId: state.selectedAccountId || accounts[0]?.id || null,
    })),
}));
