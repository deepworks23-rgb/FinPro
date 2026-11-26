import { useCallback, useEffect, useMemo, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { BudgetsScreen } from './components/BudgetsScreen';
import { ConfirmDialog, type ConfirmDialogRequest } from './components/ConfirmDialog';
import { DashboardScreen } from './components/DashboardScreen';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { NotificationsModal, ProfileModal } from './components/Overlays';
import { ReportsScreen } from './components/ReportsScreen';
import { TransactionModal } from './components/TransactionModal';
import { TransactionsScreen } from './components/TransactionsScreen';
import {
  DEFAULT_ALERT_SETTINGS,
  getInitialGoals,
  getInitialTransactions,
  INITIAL_BUDGET_CATEGORIES,
} from './data/seed';
import type {
  AlertSettings,
  AppScreen,
  BudgetCategory,
  CurrencyCode,
  FinancialGoal,
  Transaction,
  TransactionType,
} from './types/finance';
import {
  buildTransactionsCSV,
  computeRealMonthExpenseByBudgetCategory,
  computeRealTimeAlerts,
  computeTransactionSummary,
  formatMoney,
  syncBudgetsWithTransactions,
  toLocalISODate,
} from './utils/finance';

const STORAGE_KEYS = {
  transactions: 'fintrack_mz_transactions_v1',
  budgets: 'fintrack_mz_budgets_v2',
  goals: 'fintrack_mz_goals_v1',
  currency: 'fintrack_mz_currency_v1',
  hideBalance: 'fintrack_mz_hide_balance',
  userEmail: 'fintrack_mz_user_email',
  userName: 'fintrack_mz_user_name',
  alertSettings: 'fintrack_mz_alert_settings_v1',
  readAlerts: 'fintrack_mz_read_alerts_v1',
};

function readStoredJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredCurrency(): CurrencyCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.currency);
    return stored === 'USD' || stored === 'MZN' ? stored : 'MZN';
  } catch {
    return 'MZN';
  }
}

function getInitialScreen(): AppScreen {
  const params = new URLSearchParams(window.location.search);
  const s = params.get('screen');
  if (
    s === 'dashboard-inicio' ||
    s === 'transacoes' ||
    s === 'orcamentos' ||
    s === 'relatorios' ||
    s === 'login'
  ) {
    return s;
  }
  return 'dashboard-inicio';
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(getInitialScreen);
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('dashboard-inicio');
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    readStoredJSON(STORAGE_KEYS.transactions, getInitialTransactions())
  );
  const [budgets, setBudgets] = useState<BudgetCategory[]>(() =>
    readStoredJSON(STORAGE_KEYS.budgets, INITIAL_BUDGET_CATEGORIES)
  );
  const [goals, setGoals] = useState<FinancialGoal[]>(() =>
    readStoredJSON(STORAGE_KEYS.goals, getInitialGoals())
  );

  const [currency, setCurrency] = useState<CurrencyCode>(readStoredCurrency);
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEYS.hideBalance) === 'true'
  );
  const [userEmail, setUserEmail] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.userEmail) || 'edson.machava@fintrack.co.mz'
  );
  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.userName) || 'Edson Machava'
  );
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() => ({
    ...DEFAULT_ALERT_SETTINGS,
    ...readStoredJSON<Partial<AlertSettings>>(STORAGE_KEYS.alertSettings, {}),
  }));
  const [readAlertSignatures, setReadAlertSignatures] = useState<string[]>(() =>
    readStoredJSON<string[]>(STORAGE_KEYS.readAlerts, [])
  );

  // Modals & Overlays
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Real-time clock tick (every 30s) & cross-tab storage synchronization
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(new Date());
    }, 30000);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.transactions && e.newValue) {
        setTransactions(JSON.parse(e.newValue) as Transaction[]);
      } else if (e.key === STORAGE_KEYS.budgets && e.newValue) {
        setBudgets(JSON.parse(e.newValue) as BudgetCategory[]);
      } else if (e.key === STORAGE_KEYS.goals && e.newValue) {
        setGoals(JSON.parse(e.newValue) as FinancialGoal[]);
      } else if (e.key === STORAGE_KEYS.currency && (e.newValue === 'MZN' || e.newValue === 'USD')) {
        setCurrency(e.newValue);
      } else if (e.key === STORAGE_KEYS.alertSettings && e.newValue) {
        setAlertSettings({
          ...DEFAULT_ALERT_SETTINGS,
          ...(JSON.parse(e.newValue) as Partial<AlertSettings>),
        });
      } else if (e.key === STORAGE_KEYS.readAlerts && e.newValue) {
        setReadAlertSignatures(JSON.parse(e.newValue) as string[]);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.currency, currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.hideBalance, String(isBalanceHidden));
  }, [isBalanceHidden]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.userEmail, userEmail);
  }, [userEmail]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.userName, userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.alertSettings, JSON.stringify(alertSettings));
  }, [alertSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.readAlerts, JSON.stringify(readAlertSignatures));
  }, [readAlertSignatures]);

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

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  const navigateTo = useCallback(
    (next: AppScreen) => {
      if (next !== screen) {
        if (next === 'login') {
          setPreviousScreen(screen);
        }
        setScreen(next);
        window.scrollTo({ top: 0, behavior: 'instant' });
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
          id: `tx_${Date.now()}`,
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
        id: `cat_${Date.now()}`,
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
      id: `goal_${Date.now()}`,
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
    const csv = buildTransactionsCSV(transactions);
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
  }, [transactions, showToast]);

  const handleResetDemo = useCallback(() => {
    const now = new Date();
    setNowTick(now);
    setTransactions(getInitialTransactions(now));
    setBudgets(INITIAL_BUDGET_CATEGORIES);
    setGoals(getInitialGoals(now));
    setCurrency('MZN');
    setIsBalanceHidden(false);
    setUserName('Edson Machava');
    setUserEmail('edson.machava@fintrack.co.mz');
    setAlertSettings(DEFAULT_ALERT_SETTINGS);
    setReadAlertSignatures([]);
    showToast('Dados de demonstração restaurados!');
  }, [showToast]);

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
    if (!alertSettings.enableLowBalanceAlerts) return null;
    if (summary.netBalance <= alertSettings.negativeAlertThreshold) return 'critical';
    if (summary.netBalance <= alertSettings.lowBalanceThreshold) return 'warning';
    return null;
  }, [alertSettings, summary.netBalance]);

  const firstName = userName.trim().split(' ')[0] || 'Edson';

  return (
    <div className="min-h-screen w-full bg-surface-container-low/60 flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen bg-surface flex flex-col shadow-[0_0_40px_rgba(19,27,46,0.06)]">
        <Header
          balanceAlertStatus={balanceAlertStatus}
          currency={currency}
          firstName={firstName}
          hasCriticalAlert={hasCriticalAlert}
          now={nowTick}
          onBack={() => navigateTo(previousScreen === 'login' ? 'dashboard-inicio' : previousScreen)}
          onChangeCurrency={(next) => {
            setCurrency(next);
            showToast(`Moeda alterada para ${next}`);
          }}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          screen={screen}
          unreadNotificationsCount={unreadAlertsCount}
        />

        <main
          className={`flex flex-col relative w-full flex-1 bg-surface ${
            screen === 'login' ? 'pt-14 pb-safe' : 'pt-16 pb-20'
          }`}
        >
          {screen === 'dashboard-inicio' && (
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

          {screen === 'transacoes' && (
            <TransactionsScreen
              currency={currency}
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={handleEditTransaction}
              onOpenNew={() => handleOpenNewTransaction('expense')}
              onRequestConfirm={requestConfirm}
              onToggleStatus={handleToggleTransactionStatus}
              transactions={transactions}
            />
          )}

          {screen === 'orcamentos' && (
            <BudgetsScreen
              budgets={liveBudgets}
              currency={currency}
              goals={goals}
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

          {screen === 'relatorios' && (
            <ReportsScreen
              currency={currency}
              onNavigate={navigateTo}
              transactions={transactions}
            />
          )}

          {screen === 'login' && (
            <LoginScreen
              initialEmail={userEmail}
              onAuthenticated={(email) => {
                setUserEmail(email);
                navigateTo('dashboard-inicio');
                showToast('Sessão iniciada com sucesso!');
              }}
              onBack={() =>
                navigateTo(previousScreen === 'login' ? 'dashboard-inicio' : previousScreen)
              }
            />
          )}
        </main>

        <BottomNav
          activeScreen={screen}
          onNavigate={navigateTo}
          onOpenNewTransaction={() => handleOpenNewTransaction('expense')}
        />

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

        <ProfileModal
          currency={currency}
          isOpen={profileOpen}
          onChangeCurrency={(c) => {
            setCurrency(c);
            showToast(`Moeda alterada para ${c}`);
          }}
          onClose={() => setProfileOpen(false)}
          onOpenLogin={() => navigateTo('login')}
          onRequestConfirm={requestConfirm}
          onResetDemo={handleResetDemo}
          onUpdateName={(nextName) => {
            setUserName(nextName);
            showToast('Perfil atualizado!');
          }}
          userEmail={userEmail}
          userName={userName}
        />

        <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />

        {/* Toast Notification Box */}
        {toastMsg && (
          <div
            aria-live="polite"
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-full font-label-sm text-label-sm shadow-xl flex items-center gap-2 z-[70] whitespace-nowrap"
            role="status"
          >
            <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
