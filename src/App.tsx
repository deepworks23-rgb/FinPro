import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { BudgetsScreen } from './components/BudgetsScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { NotificationsModal, ProfileModal } from './components/Overlays';
import { ReportsScreen } from './components/ReportsScreen';
import { TransactionModal } from './components/TransactionModal';
import { TransactionsScreen } from './components/TransactionsScreen';
import {
  getInitialGoals,
  getInitialTransactions,
  INITIAL_BUDGET_CATEGORIES,
} from './data/seed';
import type {
  AppScreen,
  BudgetCategory,
  CurrencyCode,
  FinancialGoal,
  Transaction,
  TransactionType,
} from './types/finance';
import { buildTransactionsCSV, evaluateBudgetStatus, toLocalISODate } from './utils/finance';

const STORAGE_KEYS = {
  transactions: 'fintrack_transactions_v3',
  budgets: 'fintrack_budgets_v2',
  goals: 'fintrack_goals_v3',
  currency: 'fintrack_currency_v2',
  hideBalance: 'fintrack_hide_balance',
  userEmail: 'fintrack_user_email',
  userName: 'fintrack_user_name',
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
    () => localStorage.getItem(STORAGE_KEYS.userEmail) || 'lucas.silva@fintrack.com'
  );
  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.userName) || 'Lucas Silva'
  );

  // Modals & Overlays
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
      if (payload.id) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === payload.id ? { ...payload, id: payload.id } : t))
        );
        showToast('Transação atualizada com sucesso!');
      } else {
        const newTx: Transaction = {
          ...payload,
          id: `tx_${Date.now()}`,
        };
        setTransactions((prev) => [newTx, ...prev]);
        showToast('Transação adicionada com sucesso!');
      }
    },
    [showToast]
  );

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast('Transação excluída.');
    },
    [showToast]
  );

  const handleAddBudget = useCallback((budget: Omit<BudgetCategory, 'id'>) => {
    const newBudget: BudgetCategory = {
      ...budget,
      id: `cat_${Date.now()}`,
    };
    setBudgets((prev) => [newBudget, ...prev]);
  }, []);

  const handleUpdateBudget = useCallback(
    (id: string, updates: Pick<BudgetCategory, 'limit' | 'spent'>) => {
      setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
      showToast('Orçamento atualizado!');
    },
    [showToast]
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
      showToast('Aporte registrado na meta!');
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
    setTransactions(getInitialTransactions());
    setBudgets(INITIAL_BUDGET_CATEGORIES);
    setGoals(getInitialGoals());
    setCurrency('MZN');
    setIsBalanceHidden(false);
    setUserName('Lucas Silva');
    setUserEmail('lucas.silva@fintrack.com');
    showToast('Dados de demonstração restaurados!');
  }, [showToast]);

  const unreadAlertsCount = budgets.filter(
    (b) => evaluateBudgetStatus(b.spent, b.limit, currency).percentage >= 75
  ).length;

  const firstName = userName.trim().split(' ')[0] || 'Lucas';

  return (
    <div className="min-h-screen w-full bg-surface-container-low/60 flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen bg-surface flex flex-col shadow-[0_0_40px_rgba(19,27,46,0.06)]">
        <Header
          onBack={() => navigateTo(previousScreen === 'login' ? 'dashboard-inicio' : previousScreen)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          screen={screen}
          unreadNotificationsCount={unreadAlertsCount}
        />

        <main
          className={`flex flex-col relative w-full flex-1 pt-16 bg-surface ${
            screen === 'login' ? 'pb-safe' : 'pb-28'
          }`}
        >
          {screen === 'dashboard-inicio' && (
            <DashboardScreen
              currency={currency}
              firstName={firstName}
              isBalanceHidden={isBalanceHidden}
              onChangeCurrency={setCurrency}
              onEditTransaction={handleEditTransaction}
              onExportCSV={handleExportCSV}
              onNavigate={navigateTo}
              onNotify={showToast}
              onOpenNewTransaction={handleOpenNewTransaction}
              onToggleHideBalance={() => setIsBalanceHidden((v) => !v)}
              transactions={transactions}
            />
          )}

          {screen === 'transacoes' && (
            <TransactionsScreen
              currency={currency}
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={handleEditTransaction}
              onOpenNew={() => handleOpenNewTransaction('expense')}
              transactions={transactions}
            />
          )}

          {screen === 'orcamentos' && (
            <BudgetsScreen
              budgets={budgets}
              currency={currency}
              goals={goals}
              onAddBudget={handleAddBudget}
              onAddGoal={handleAddGoal}
              onContributeGoal={handleContributeGoal}
              onDeleteBudget={handleDeleteBudget}
              onDeleteGoal={handleDeleteGoal}
              onNotify={showToast}
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
          currency={currency}
          editingTransaction={editingTx}
          initialType={txModalType}
          isOpen={txModalOpen}
          onClose={() => {
            setTxModalOpen(false);
            setEditingTx(null);
          }}
          onSave={handleSaveTransaction}
        />

        <NotificationsModal
          budgets={budgets}
          currency={currency}
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onGoToBudgets={() => navigateTo('orcamentos')}
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
          onResetDemo={handleResetDemo}
          onUpdateName={(nextName) => {
            setUserName(nextName);
            showToast('Perfil atualizado!');
          }}
          userEmail={userEmail}
          userName={userName}
        />

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
