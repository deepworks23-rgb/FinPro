import { AdminScreen } from './components/AdminScreen';
import { AppIcon } from './components/AppIcon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { BudgetsScreen } from './components/BudgetsScreen';
import { ConfirmDialog, type ConfirmDialogRequest } from './components/ConfirmDialog';
import { DashboardScreen } from './components/DashboardScreen';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { LoginScreen } from './components/LoginScreen';
import { NotificationsModal } from './components/Overlays';
import { PricingModal } from './components/PricingModal';
import { ProfileScreen } from './components/ProfileScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { Sidebar } from './components/Sidebar';
import { TransactionModal } from './components/TransactionModal';
import { TransactionsScreen } from './components/TransactionsScreen';
import { DEFAULT_ALERT_SETTINGS } from './data/seed';
import { authApi, subscriptionApi, type AuthResponse } from './services/api';
import type {
  AlertSettings,
  AppScreen,
  BudgetCategory,
  CurrencyCode,
  FinancialGoal,
  Transaction,
  TransactionType,
  UserProfile,
  UserSubscription,
  UserWorkspacePayload,
} from './types/finance';
import {
  buildStyledReportCSV,
  computeRealMonthExpenseByBudgetCategory,
  computeRealTimeAlerts,
  computeTransactionSummary,
  formatMoney,
  syncBudgetsWithTransactions,
  toLocalISODate,
} from './utils/finance';
import { pathToScreen, syncBrowserPath } from './utils/router';

function makeEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const AUTH_TOKEN_STORAGE_KEY = 'fintrack_auth_token';

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string): void {
  try {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() =>
    Boolean(readStoredToken())
  );

  const [screen, setScreen] = useState<AppScreen>(() =>
    typeof window !== 'undefined' ? pathToScreen(window.location.pathname) : 'landing'
  );
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('dashboard-inicio');
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  // Listen to browser Back / Forward buttons and sync screen state
  useEffect(() => {
    const handlePopState = () => {
      const nextScreen = pathToScreen(window.location.pathname);
      setScreen(nextScreen);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Authenticated workspace state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>('MZN');
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [readAlertSignatures, setReadAlertSignatures] = useState<string[]>([]);

  // Skip immediate PUT right after hydrating from login/register
  const skipNextWorkspaceSyncRef = useRef(false);

  // Modals & Overlays
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // SaaS Subscription State
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);

  // Real-time clock tick (every 30s)
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(new Date());
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  const applyWorkspace = useCallback((ws: UserWorkspacePayload) => {
    skipNextWorkspaceSyncRef.current = true;
    setTransactions(Array.isArray(ws.transactions) ? ws.transactions : []);
    setBudgets(Array.isArray(ws.budgets) ? ws.budgets : []);
    setGoals(Array.isArray(ws.goals) ? ws.goals : []);
    setCurrency(ws.currency === 'USD' ? 'USD' : 'MZN');
    setIsBalanceHidden(Boolean(ws.isBalanceHidden));
    setAlertSettings({
      ...DEFAULT_ALERT_SETTINGS,
      ...(ws.alertSettings ?? {}),
    });
    setReadAlertSignatures(Array.isArray(ws.readAlertSignatures) ? ws.readAlertSignatures : []);
  }, []);

  // Track unsaved workspace payload so page refresh/close flushes immediately
  const pendingWorkspaceFlushRef = useRef<UserWorkspacePayload | null>(null);

  // Persist workspace mutations to backend for authenticated user
  useEffect(() => {
    if (!authToken || !currentUser) return;
    if (skipNextWorkspaceSyncRef.current) {
      skipNextWorkspaceSyncRef.current = false;
      return;
    }

    const payload: UserWorkspacePayload = {
      transactions,
      budgets,
      goals,
      currency,
      isBalanceHidden,
      alertSettings,
      readAlertSignatures,
    };
    pendingWorkspaceFlushRef.current = payload;

    const timer = window.setTimeout(() => {
      pendingWorkspaceFlushRef.current = null;
      void authApi.saveWorkspace(authToken, payload).catch(() => {
        showToast('Erro ao guardar dados no servidor. Verifique a ligação.');
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    authToken,
    currentUser,
    transactions,
    budgets,
    goals,
    currency,
    isBalanceHidden,
    alertSettings,
    readAlertSignatures,
    showToast,
  ]);

  // Flush any pending workspace write when tab hides or page unloads
  useEffect(() => {
    if (!authToken || !currentUser) return;

    const flushPending = () => {
      const pending = pendingWorkspaceFlushRef.current;
      if (!pending) return;
      pendingWorkspaceFlushRef.current = null;
      void authApi.saveWorkspace(authToken, pending, { keepalive: true }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPending();
      }
    };

    window.addEventListener('beforeunload', flushPending);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushPending);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authToken, currentUser]);

  // Restore persisted session on page load via /api/auth/me
  useEffect(() => {
    const savedToken = readStoredToken();
    const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    const initialScreen = pathToScreen(initialPath);

    if (!savedToken) {
      setIsRestoringSession(false);
      if (initialScreen === 'landing' || initialScreen === 'login') {
        setScreen(initialScreen);
        syncBrowserPath(initialScreen, true);
      } else {
        setScreen('login');
        syncBrowserPath('login', true);
      }
      return;
    }

    let cancelled = false;
    authApi
      .me(savedToken)
      .then((res) => {
        if (cancelled) return;
        setAuthToken(savedToken);
        setCurrentUser(res.user);
        applyWorkspace(res.workspace);
        setPreviousScreen('dashboard-inicio');

        if (res.user.isAdmin) {
          const targetScreen = initialScreen.startsWith('app') ? initialScreen : 'admin';
          setScreen(targetScreen);
          syncBrowserPath(targetScreen, true);
        } else if (initialScreen === 'login') {
          setScreen('dashboard-inicio');
          syncBrowserPath('dashboard-inicio', true);
        } else {
          setScreen(initialScreen);
          syncBrowserPath(initialScreen, true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredToken();
        setAuthToken(null);
        setCurrentUser(null);
        if (initialScreen !== 'landing') {
          setScreen('login');
          syncBrowserPath('login', true);
        } else {
          setScreen('landing');
          syncBrowserPath('landing', true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyWorkspace]);

  // Load SaaS Subscription when authenticated
  useEffect(() => {
    if (!authToken) {
      setSubscription(null);
      return;
    }
    let cancelled = false;
    subscriptionApi
      .getSubscription(authToken)
      .then((res) => {
        if (!cancelled && res.ok) {
          setSubscription(res.subscription);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const handleAuthenticated = useCallback(
    (auth: AuthResponse, mode: 'login' | 'register') => {
      writeStoredToken(auth.token);
      setAuthToken(auth.token);
      setCurrentUser(auth.user);
      applyWorkspace(auth.workspace);
      setPreviousScreen('dashboard-inicio');
      window.scrollTo({ top: 0, behavior: 'instant' });

      // When admin logs in, open DIRECTLY on the admin page!
      const targetScreen = auth.user.isAdmin ? 'admin' : 'dashboard-inicio';

      setScreen(targetScreen);
      syncBrowserPath(targetScreen, true);

      if (mode === 'register') {
        showToast(`Bem-vindo(a), ${auth.user.name.split(' ')[0]}!`);
      } else if (auth.user.isAdmin) {
        showToast('Bem-vindo ao Painel de Administração SaaS!');
      } else {
        showToast('Sessão iniciada com sucesso!');
      }
    },
    [applyWorkspace, showToast]
  );

  const handleLogout = useCallback(async () => {
    if (authToken) {
      const pending = pendingWorkspaceFlushRef.current;
      if (pending) {
        pendingWorkspaceFlushRef.current = null;
        await authApi.saveWorkspace(authToken, pending, { keepalive: true }).catch(() => {});
      }
      await authApi.logout(authToken).catch(() => {});
    }
    clearStoredToken();
    skipNextWorkspaceSyncRef.current = true;
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setCurrency('MZN');
    setIsBalanceHidden(false);
    setAlertSettings(DEFAULT_ALERT_SETTINGS);
    setReadAlertSignatures([]);
    setAuthToken(null);
    setCurrentUser(null);
    setNotificationsOpen(false);
    setTxModalOpen(false);
    setEditingTx(null);
    setScreen('login');
    syncBrowserPath('login', true);
    window.scrollTo({ top: 0, behavior: 'instant' });
    showToast('Sessão terminada.');
  }, [authToken, showToast]);

  const handleUpdateProfile = useCallback(
    async (updates: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      avatarDataUrl?: string;
      currency?: CurrencyCode;
    }) => {
      if (!authToken) return;
      const res = await authApi.updateProfile(authToken, updates);
      setCurrentUser(res.user);
      if (updates.currency) {
        setCurrency(updates.currency);
      }
    },
    [authToken]
  );

  const handleChangePassword = useCallback(
    async (payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      if (!authToken) return;
      const res = await authApi.changePassword(authToken, payload);
      setCurrentUser(res.user);
    },
    [authToken]
  );

  // Real-time budgets derived dynamically from transactions of the current month
  const liveBudgets = useMemo(
    () => syncBudgetsWithTransactions(budgets, transactions, nowTick),
    [budgets, transactions, nowTick]
  );

  const summary = useMemo(() => computeTransactionSummary(transactions), [transactions]);

  const realTimeAlerts = useMemo(
    () =>
      computeRealTimeAlerts({
        transactions,
        budgets: liveBudgets,
        goals,
        settings: alertSettings,
        currency,
        now: nowTick,
      }),
    [transactions, liveBudgets, goals, alertSettings, currency, nowTick]
  );

  const navigateTo = useCallback(
    (next: AppScreen, replace = false) => {
      if (next !== screen) {
        if (next === 'perfil' && screen !== 'login') {
          setPreviousScreen(screen);
        }
        setScreen(next);
        syncBrowserPath(next, replace);
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        syncBrowserPath(next, true);
      }
    },
    [screen]
  );

  const handleOpenNewTransaction = useCallback((type: TransactionType = 'expense') => {
    setEditingTx(null);
    setTxModalType(type);
    setTxModalOpen(true);
  }, []);

  const handleEditTransaction = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setTxModalType(tx.type);
    setTxModalOpen(true);
  }, []);

  const handleSaveTransaction = useCallback(
    (payload: Omit<Transaction, 'id'> & { id?: string }) => {
      setNowTick(new Date());
      if (payload.id) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === payload.id ? { ...payload, id: payload.id } : t))
        );
        showToast('Transação atualizada em tempo real!');
      } else {
        const newTx: Transaction = {
          ...payload,
          id: makeEntityId('tx'),
        };
        setTransactions((prev) => [newTx, ...prev]);
        showToast('Transação registada com sucesso!');
      }
    },
    [showToast]
  );

  const requestConfirm = useCallback((req: ConfirmDialogRequest) => {
    setConfirmRequest(req);
  }, []);

  const handleToggleTransactionStatus = useCallback(
    (id: string) => {
      const target = transactions.find((t) => t.id === id);
      if (!target) return;

      const nextStatus = target.status === 'completed' ? 'pending' : 'completed';
      const nextLabel =
        nextStatus === 'completed'
          ? target.type === 'income'
            ? 'Recebido'
            : 'Pago'
          : 'Pendente';
      const toastText =
        nextStatus === 'completed'
          ? target.type === 'income'
            ? 'Marcada como Recebida!'
            : 'Marcada como Paga!'
          : 'Alterada para Pendente!';

      requestConfirm({
        variant: 'primary',
        icon: nextStatus === 'completed' ? 'check_circle' : 'schedule',
        title: `Marcar como ${nextLabel}?`,
        message: `Deseja alterar o estado desta transação para "${nextLabel}"?`,
        details: `${target.description} · ${target.type === 'income' ? '+' : '-'}${formatMoney(target.amount, currency)}`,
        confirmLabel: `Sim, ${nextLabel}`,
        cancelLabel: 'Voltar',
        onConfirm: () => {
          setNowTick(new Date());
          setTransactions((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
          );
          showToast(toastText);
        },
      });
    },
    [transactions, currency, requestConfirm, showToast]
  );

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      setNowTick(new Date());
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast('Transação excluída.');
    },
    [showToast]
  );

  const handleAddBudget = useCallback(
    (budget: Omit<BudgetCategory, 'id'>) => {
      const realMap = computeRealMonthExpenseByBudgetCategory(transactions, nowTick);
      const realSpent = realMap.get(budget.category) ?? 0;
      const newBudget: BudgetCategory = {
        ...budget,
        manualSpentOffset: Math.round((budget.spent - realSpent) * 100) / 100,
        id: makeEntityId('cat'),
      };
      setBudgets((prev) => [newBudget, ...prev]);
    },
    [transactions, nowTick]
  );

  const handleUpdateBudget = useCallback(
    (id: string, updates: Pick<BudgetCategory, 'limit' | 'spent'>) => {
      const realMap = computeRealMonthExpenseByBudgetCategory(transactions, nowTick);
      setBudgets((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const realSpent = realMap.get(b.category) ?? 0;
          return {
            ...b,
            limit: updates.limit,
            spent: updates.spent,
            manualSpentOffset: Math.round((updates.spent - realSpent) * 100) / 100,
          };
        })
      );
      showToast('Orçamento atualizado!');
    },
    [transactions, nowTick, showToast]
  );

  const handleDeleteBudget = useCallback(
    (id: string) => {
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      showToast('Orçamento removido.');
    },
    [showToast]
  );

  const handleAddGoal = useCallback((goal: Omit<FinancialGoal, 'id'>) => {
    const newGoal: FinancialGoal = {
      ...goal,
      id: makeEntityId('goal'),
    };
    setGoals((prev) => [...prev, newGoal]);
  }, []);

  const handleContributeGoal = useCallback(
    (id: string, addedAmountBase: number) => {
      setGoals((prev) =>
        prev.map((g) => (g.id === id ? { ...g, current: Math.max(0, g.current + addedAmountBase) } : g))
      );
      showToast('Reforço registado na meta!');
    },
    [showToast]
  );

  const handleDeleteGoal = useCallback(
    (id: string) => {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      showToast('Meta financeira removida.');
    },
    [showToast]
  );

  const handleExportCSV = useCallback(() => {
    const csv = buildStyledReportCSV({
      transactions,
      currency,
      periodLabel: 'Extrato Completo',
      userName: currentUser?.name ?? 'Utilizador FinTrack',
      userPhone: currentUser?.phone ?? '',
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FinTrack_Extrato_${toLocalISODate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Extrato CSV baixado com sucesso!');
  }, [transactions, currency, currentUser, showToast]);

  const handleUpdateAlertSettings = useCallback(
    (next: AlertSettings) => {
      setAlertSettings(next);
      showToast('Limites de alerta atualizados!');
    },
    [showToast]
  );

  const handleMarkAlertRead = useCallback((signature: string) => {
    setReadAlertSignatures((prev) => (prev.includes(signature) ? prev : [...prev, signature]));
  }, []);

  const handleMarkAllAlertsRead = useCallback(() => {
    setReadAlertSignatures((prev) => {
      const merged = new Set([...prev, ...realTimeAlerts.map((a) => a.signature)]);
      return Array.from(merged);
    });
    showToast('Alertas marcados como lidos.');
  }, [realTimeAlerts, showToast]);

  const unreadAlertsCount = useMemo(
    () => realTimeAlerts.filter((a) => !readAlertSignatures.includes(a.signature)).length,
    [realTimeAlerts, readAlertSignatures]
  );

  const hasCriticalAlert = useMemo(
    () =>
      realTimeAlerts.some(
        (a) => a.severity === 'critical' && !readAlertSignatures.includes(a.signature)
      ),
    [realTimeAlerts, readAlertSignatures]
  );

  const balanceAlertStatus: 'critical' | 'warning' | null = useMemo(() => {
    if (transactions.length === 0 || !alertSettings.enableLowBalanceAlerts) return null;
    if (summary.netBalance <= alertSettings.negativeAlertThreshold) return 'critical';
    if (summary.netBalance <= alertSettings.lowBalanceThreshold) return 'warning';
    return null;
  }, [transactions.length, alertSettings, summary.netBalance]);

  const isAuthenticated = Boolean(authToken && currentUser);
  const activeScreen: AppScreen = screen;

  // 0. Loading Screen while restoring session token
  if (isRestoringSession) {
    return (
      <div className="min-h-screen w-full bg-surface flex flex-col items-center justify-center gap-3 p-6 text-center text-on-surface">
        <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/25 animate-pulse">
          <AppIcon name="account_balance_wallet" className="text-[26px]" filled />
        </div>
        <div className="w-8 h-8 rounded-full border-3 border-primary/20 border-t-primary animate-spin mt-2" />
        <p className="text-[13px] font-medium text-on-surface-variant">A carregar o FinTrack...</p>
      </div>
    );
  }

  // 1. ÁREA PÚBLICA: Landing Page de Marketing & Vendas
  if (activeScreen === 'landing') {
    return (
      <>
        <LandingPage
          isAuthenticated={isAuthenticated}
          onGoToDashboard={() => navigateTo('dashboard-inicio')}
          onGoToLogin={() => navigateTo('login')}
          onGoToRegister={() => navigateTo('login')}
          onSelectPlan={() => {
            if (isAuthenticated) {
              setPricingModalOpen(true);
            } else {
              navigateTo('login');
              setPricingModalOpen(true);
            }
          }}
        />
        <PricingModal
          authToken={authToken}
          currency={currency}
          currentSubscription={subscription}
          isOpen={pricingModalOpen}
          onClose={() => setPricingModalOpen(false)}
          onNotify={showToast}
        />
        {toastMsg && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium flex items-center gap-2 animate-fade-in pointer-events-none">
            <AppIcon name="info" className="text-[17px] text-primary" />
            <span>{toastMsg}</span>
          </div>
        )}
      </>
    );
  }

  // 2. ÁREA DE AUTENTICAÇÃO: Login & Cadastro
  if (activeScreen === 'login') {
    if (isAuthenticated) {
      navigateTo('dashboard-inicio', true);
      return null;
    }
    return (
      <div className="min-h-screen w-full bg-surface-container-low/40 flex items-center justify-center p-3 sm:p-6 text-on-surface">
        <LoginScreen
          onAuthenticated={handleAuthenticated}
          onGoToLanding={() => navigateTo('landing')}
          onOpenPricing={() => setPricingModalOpen(true)}
        />
        {toastMsg && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium flex items-center gap-2 animate-fade-in pointer-events-none">
            <AppIcon name="info" className="text-[17px] text-primary" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    );
  }

  // 3. ÁREA ADMINISTRATIVA: Painel Backoffice SaaS
  if (activeScreen === 'admin') {
    if (!isAuthenticated || !authToken || !currentUser) {
      return (
        <div className="min-h-screen w-full bg-surface-container-low/40 flex items-center justify-center p-4 text-on-surface">
          <div className="max-w-md w-full bg-surface-container-lowest p-6 rounded-2xl shadow-xl border border-surface-container text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary mx-auto flex items-center justify-center shadow-md shadow-primary/20">
              <AppIcon name="admin_panel_settings" className="text-[30px]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[19px] font-bold text-on-surface">Acesso ao Painel Admin SaaS</h2>
              <p className="text-[13px] text-on-surface-variant leading-relaxed">
                Inicie sessão com uma conta de administrador para gerir métricas (MRR), utilizadores e subscrições.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                className="w-full h-11 rounded-xl bg-primary text-on-primary font-bold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-primary-container"
                onClick={() => navigateTo('login')}
                type="button"
              >
                <AppIcon name="login" className="text-[19px]" />
                <span>Entrar como Administrador</span>
              </button>
              <button
                className="w-full h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={() => navigateTo('landing')}
                type="button"
              >
                <AppIcon name="public" className="text-[17px] text-primary" />
                <span>Voltar à Página Pública</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!currentUser?.isAdmin && !currentUser?.isDemo) {
      return (
        <div className="min-h-screen w-full bg-surface-container-low/40 flex items-center justify-center p-4 text-on-surface">
          <div className="max-w-md w-full bg-surface-container-lowest p-6 rounded-2xl shadow-xl border border-error/25 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-error-container text-on-error-container mx-auto flex items-center justify-center">
              <AppIcon name="lock" className="text-[30px]" />
            </div>
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-mono text-[11px] font-bold">
                Erro 403 · Acesso Não Autorizado
              </span>
              <h2 className="text-[19px] font-bold text-on-surface pt-2">Área Administrativa Restrita</h2>
            </div>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              A sua conta ({currentUser?.email || currentUser?.phone}) não possui permissões administrativas na plataforma FinTrack.
            </p>
            <div className="space-y-2 pt-2">
              <button
                className="w-full h-11 rounded-xl bg-primary text-on-primary font-bold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-primary-container"
                onClick={() => navigateTo('dashboard-inicio')}
                type="button"
              >
                <AppIcon name="dashboard" className="text-[19px]" />
                <span>Voltar ao Meu Painel Financeiro (/app)</span>
              </button>
              <button
                className="w-full h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-[12.5px] flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={() => void handleLogout()}
                type="button"
              >
                <AppIcon name="logout" className="text-[17px]" />
                <span>Terminar Sessão e Trocar de Conta</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full bg-surface-container-low/30 flex flex-col text-on-surface">
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <AdminScreen
            authToken={authToken}
            currency={currency}
            onLogout={handleLogout}
            onNavigateToApp={() => navigateTo('dashboard-inicio')}
            onNavigateToLanding={() => navigateTo('landing')}
            onNotify={showToast}
          />
        </main>
        {toastMsg && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium flex items-center gap-2 animate-fade-in pointer-events-none">
            <AppIcon name="info" className="text-[17px] text-primary" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    );
  }

  // 4. ÁREA DO APLICATIVO DO CLIENTE (/app/*): Requer Login
  if (!isAuthenticated || !authToken || !currentUser) {
    navigateTo('login', true);
    return null;
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden w-full bg-surface-container-low/40 flex flex-col md:flex-row text-on-surface">
      {/* Desktop Permanent Sidebar */}
      {isAuthenticated && currentUser && (
        <Sidebar
          activeScreen={activeScreen}
          currency={currency}
          hasCriticalAlert={hasCriticalAlert}
          onChangeCurrency={(next) => {
            setCurrency(next);
            showToast(`Moeda alterada para ${next}`);
          }}
          onLogout={handleLogout}
          onNavigate={navigateTo}
          onOpenNewTransaction={() => handleOpenNewTransaction('expense')}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenPricing={() => setPricingModalOpen(true)}
          subscriptionPlan={subscription?.plan ?? 'free'}
          unreadNotificationsCount={unreadAlertsCount}
          user={currentUser}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen md:min-h-0 md:h-screen md:overflow-hidden relative bg-surface">
        {/* Mobile Fixed Top Header */}
        {isAuthenticated && currentUser && (
          <Header
            avatarUrl={currentUser.avatarDataUrl}
            balanceAlertStatus={balanceAlertStatus}
            currency={currency}
            desktop={false}
            hasCriticalAlert={hasCriticalAlert}
            now={nowTick}
            onBack={() =>
              navigateTo(
                previousScreen === 'login' || previousScreen === 'perfil'
                  ? 'dashboard-inicio'
                  : previousScreen
              )
            }
            onChangeCurrency={(next) => {
              setCurrency(next);
              showToast(`Moeda alterada para ${next}`);
            }}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onOpenPricing={() => setPricingModalOpen(true)}
            onOpenProfile={() => navigateTo('perfil')}
            screen={activeScreen}
            subscriptionPlan={subscription?.plan ?? 'free'}
            isAdmin={Boolean(currentUser.isAdmin)}
            unreadNotificationsCount={unreadAlertsCount}
            userName={currentUser.name}
          />
        )}

        {/* Desktop Sticky Header */}
        {isAuthenticated && currentUser && (
          <Header
            avatarUrl={currentUser.avatarDataUrl}
            balanceAlertStatus={balanceAlertStatus}
            currency={currency}
            desktop={true}
            hasCriticalAlert={hasCriticalAlert}
            now={nowTick}
            onBack={() => navigateTo('dashboard-inicio')}
            onChangeCurrency={(next) => {
              setCurrency(next);
              showToast(`Moeda alterada para ${next}`);
            }}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onOpenPricing={() => setPricingModalOpen(true)}
            onOpenProfile={() => navigateTo('perfil')}
            screen={activeScreen}
            subscriptionPlan={subscription?.plan ?? 'free'}
            isAdmin={Boolean(currentUser.isAdmin)}
            unreadNotificationsCount={unreadAlertsCount}
            userName={currentUser.name}
          />
        )}

        <main className="flex-1 w-full max-w-[440px] md:max-w-none mx-auto md:mx-0 flex flex-col md:overflow-y-auto pt-18 md:pt-6 px-3 md:px-6 lg:px-8 pb-24 md:pb-8">

          {isAuthenticated && activeScreen === 'dashboard-inicio' && (
            <DashboardScreen
              alertSettings={alertSettings}
              currency={currency}
              isBalanceHidden={isBalanceHidden}
              now={nowTick}
              onEditTransaction={handleEditTransaction}
              onExportCSV={handleExportCSV}
              onNavigate={navigateTo}
              onNotify={showToast}
              onOpenNewTransaction={handleOpenNewTransaction}
              onOpenNotifications={() => setNotificationsOpen(true)}
              onToggleHideBalance={() => setIsBalanceHidden((v) => !v)}
              onToggleStatus={handleToggleTransactionStatus}
              transactions={transactions}
            />
          )}

          {isAuthenticated && activeScreen === 'transacoes' && (
            <TransactionsScreen
              currency={currency}
              isBalanceHidden={isBalanceHidden}
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={handleEditTransaction}
              onOpenNew={() => handleOpenNewTransaction('expense')}
              onRequestConfirm={requestConfirm}
              onToggleStatus={handleToggleTransactionStatus}
              transactions={transactions}
            />
          )}

          {isAuthenticated && activeScreen === 'orcamentos' && (
            <BudgetsScreen
              budgets={liveBudgets}
              currency={currency}
              goals={goals}
              isBalanceHidden={isBalanceHidden}
              onAddBudget={handleAddBudget}
              onAddGoal={handleAddGoal}
              onContributeGoal={handleContributeGoal}
              onDeleteBudget={handleDeleteBudget}
              onDeleteGoal={handleDeleteGoal}
              onNotify={showToast}
              onRequestConfirm={requestConfirm}
              onUpdateBudget={handleUpdateBudget}
            />
          )}

          {isAuthenticated && activeScreen === 'relatorios' && currentUser && (
            <ReportsScreen
              currency={currency}
              isBalanceHidden={isBalanceHidden}
              onNavigate={navigateTo}
              onNotify={showToast}
              transactions={transactions}
              userName={currentUser.name}
              userPhone={currentUser.phone}
            />
          )}

          {isAuthenticated && activeScreen === 'perfil' && currentUser && authToken && (
            <ProfileScreen
              authToken={authToken}
              currency={currency}
              onChangeCurrency={(next) => {
                setCurrency(next);
                showToast(`Moeda alterada para ${next}`);
              }}
              onChangePassword={handleChangePassword}
              onLogout={handleLogout}
              onNavigate={navigateTo}
              onNotify={showToast}
              onOpenPricing={() => setPricingModalOpen(true)}
              onRequestConfirm={requestConfirm}
              onUpdateProfile={handleUpdateProfile}
              subscription={subscription}
              user={currentUser}
            />
          )}
        </main>

        {isAuthenticated && (
          <BottomNav
            activeScreen={activeScreen}
            onNavigate={navigateTo}
            onOpenNewTransaction={() => handleOpenNewTransaction('expense')}
          />
        )}

        {isAuthenticated && (
          <>
            <TransactionModal
              budgets={liveBudgets}
              currency={currency}
              editingTransaction={editingTx}
              initialType={txModalType}
              isOpen={txModalOpen}
              onClose={() => {
                setTxModalOpen(false);
                setEditingTx(null);
              }}
              onRequestConfirm={requestConfirm}
              onSave={handleSaveTransaction}
            />

            <NotificationsModal
              alertSettings={alertSettings}
              alerts={realTimeAlerts}
              currency={currency}
              isBalanceHidden={isBalanceHidden}
              isOpen={notificationsOpen}
              netBalanceBase={summary.netBalance}
              onClose={() => setNotificationsOpen(false)}
              onMarkAlertRead={handleMarkAlertRead}
              onMarkAllRead={handleMarkAllAlertsRead}
              onNavigate={navigateTo}
              onRequestConfirm={requestConfirm}
              onUpdateAlertSettings={handleUpdateAlertSettings}
              readSignatures={readAlertSignatures}
            />
          </>
        )}

        <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />

        <PricingModal
          authToken={authToken}
          currentSubscription={subscription}
          currency={currency}
          isOpen={pricingModalOpen}
          onClose={() => setPricingModalOpen(false)}
          onNotify={showToast}
          onSubscriptionUpdated={(updated) => setSubscription(updated)}
        />

        {/* Toast Notification Box */}
        {toastMsg && (
          <div
            aria-live="polite"
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-full font-label-sm text-label-sm shadow-xl flex items-center gap-2 z-[70] whitespace-nowrap"
            role="status"
          >
            <AppIcon name="verified" className="text-secondary text-[18px]" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
