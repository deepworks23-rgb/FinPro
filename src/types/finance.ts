export type CurrencyCode = 'MZN' | 'USD';

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'completed' | 'pending';
export type TransactionRecurrence = 'none' | 'weekly' | 'monthly' | 'yearly';

export type AppScreen =
  | 'dashboard-inicio'
  | 'transacoes'
  | 'orcamentos'
  | 'relatorios'
  | 'perfil'
  | 'admin'
  | 'landing'
  | 'login';

export type ReportPeriod = 'mes' | 'trimestre' | 'ano' | 'custom';

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  avatarDataUrl: string;
  isDemo: boolean;
  isAdmin?: boolean;
  isSuspended?: boolean;
  hasPassword: boolean;
  createdAt: string;
}

export interface UserWorkspacePayload {
  transactions: Transaction[];
  budgets: BudgetCategory[];
  goals: FinancialGoal[];
  currency: CurrencyCode;
  isBalanceHidden: boolean;
  alertSettings: AlertSettings;
  readAlertSignatures: string[];
  updatedAt?: string;
}

export interface SupportTicket {
  id: string;
  code: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  subject: string;
  category: string;
  contactChannel: string;
  message: string;
  status: 'aberto' | 'em_andamento' | 'resolvido';
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  time?: string; // e.g. "09:30"
  account: string;
  status: TransactionStatus;
  paymentMethod?: string;
  recurrence?: TransactionRecurrence;
  reference?: string;
  dueDate?: string;
  notes?: string;
}

export interface BudgetCategory {
  id: string;
  category: string;
  limit: number;
  spent: number;
  manualSpentOffset?: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  isCustom?: boolean;
}

export interface FinancialGoal {
  id: string;
  title: string;
  current: number;
  target: number;
  imageUrl: string;
  barColor: string;
  accentColor: string;
}

export interface CashFlowMonth {
  month: string;
  income: number;
  expense: number;
  highlight?: boolean;
}

export interface AlertSettings {
  lowBalanceThreshold: number;
  negativeAlertThreshold: number;
  enableBudgetAlerts: boolean;
  enableGoalAlerts: boolean;
  enableLowBalanceAlerts: boolean;
  enablePendingAlerts: boolean;
}

export type RealTimeAlertSeverity = 'critical' | 'warning' | 'info' | 'success';
export type RealTimeAlertCategory = 'balance' | 'budget' | 'goal' | 'pending';

export interface RealTimeAlert {
  id: string;
  signature: string;
  category: RealTimeAlertCategory;
  severity: RealTimeAlertSeverity;
  title: string;
  description: string;
  icon: string;
  targetScreen: AppScreen;
  metricBadge?: string;
}

export type SubscriptionPlan = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface UserSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  currency: CurrencyCode;
  pricePaid: number;
  paymentMethod: string;
  paymentPhone: string;
  paymentReference: string;
  startedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanLimits {
  maxTransactionsPerMonth: number;
  maxBudgets: number;
  maxGoals: number;
  canExportPdf: boolean;
  canExportCsv: boolean;
  multiCurrency: boolean;
  prioritySupport: boolean;
}

export interface SubscriptionResponse {
  ok: boolean;
  subscription: UserSubscription;
  limits: PlanLimits;
  usage: {
    transactionsThisMonth: number;
    budgetsCount: number;
    goalsCount: number;
  };
}

export interface AdminOverviewStats {
  totalUsers: number;
  totalSubscriptions: number;
  proUsersCount: number;
  businessUsersCount: number;
  freeUsersCount: number;
  mrrMzn: number;
  openTicketsCount: number;
  weeklyRevenue?: { label: string; val: number }[];
}

export interface AdminUserItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  isAdmin: boolean;
  isSuspended?: boolean;
  createdAt: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  paymentMethod: string;
  paymentReference: string;
  billingCycle: 'monthly' | 'yearly';
}

export interface AdminSubscriptionItem {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  currency: string;
  pricePaid: number;
  paymentMethod: string;
  paymentPhone: string;
  paymentReference: string;
  startedAt: string;
  expiresAt: string | null;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isActive?: boolean;
  createdAt: string;
}

export interface SubscriptionPlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

