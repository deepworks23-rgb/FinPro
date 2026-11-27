import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ensureDbInitialized, getPool, isDatabaseConfigured } from './db.js';
import { LoginRateLimiter } from './rateLimit.js';
import {
  deleteObject,
  getPresignedObjectUrl,
  isStorageConfigured,
  S3_BUCKET,
  uploadObject,
} from './storage.js';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface StoredUser {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  email: string;
  emailNormalized: string;
  address: string;
  avatarDataUrl: string;
  avatarS3Key: string;
  passwordHash: string;
  acceptedTermsAt: string;
  isDemo: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredSupportTicket {
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
  status: 'aberto';
  createdAt: string;
}

export type SubscriptionPlan = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface StoredSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  currency: 'MZN' | 'USD';
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

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    maxTransactionsPerMonth: 25,
    maxBudgets: 3,
    maxGoals: 2,
    canExportPdf: true,
    canExportCsv: true,
    multiCurrency: false,
    prioritySupport: false,
  },
  pro: {
    maxTransactionsPerMonth: 999999,
    maxBudgets: 999999,
    maxGoals: 999999,
    canExportPdf: true,
    canExportCsv: true,
    multiCurrency: true,
    prioritySupport: true,
  },
  business: {
    maxTransactionsPerMonth: 999999,
    maxBudgets: 999999,
    maxGoals: 999999,
    canExportPdf: true,
    canExportCsv: true,
    multiCurrency: true,
    prioritySupport: true,
  },
};

interface AlertSettingsShape {
  lowBalanceThreshold: number;
  negativeAlertThreshold: number;
  enableBudgetAlerts: boolean;
  enableGoalAlerts: boolean;
  enableLowBalanceAlerts: boolean;
  enablePendingAlerts: boolean;
}

interface StoredWorkspace {
  transactions: unknown[];
  budgets: unknown[];
  goals: unknown[];
  currency: 'MZN' | 'USD';
  isBalanceHidden: boolean;
  alertSettings: AlertSettingsShape;
  readAlertSignatures: string[];
  updatedAt: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
  authTokenId?: string;
}

const DEFAULT_ALERT_SETTINGS: AlertSettingsShape = {
  lowBalanceThreshold: 5000,
  negativeAlertThreshold: 0,
  enableBudgetAlerts: true,
  enableGoalAlerts: true,
  enableLowBalanceAlerts: true,
  enablePendingAlerts: true,
};

function createEmptyWorkspace(): StoredWorkspace {
  return {
    transactions: [],
    budgets: [],
    goals: [],
    currency: 'MZN',
    isBalanceHidden: false,
    alertSettings: { ...DEFAULT_ALERT_SETTINGS },
    readAlertSignatures: [],
    updatedAt: new Date().toISOString(),
  };
}

function rowToUser(row: Record<string, unknown>): StoredUser {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    phoneNormalized: String(row.phone_normalized),
    email: String(row.email ?? ''),
    emailNormalized: String(row.email_normalized ?? ''),
    address: String(row.address),
    avatarDataUrl: String(row.avatar_data_url ?? ''),
    avatarS3Key: String(row.avatar_s3_key ?? ''),
    passwordHash: String(row.password_hash),
    acceptedTermsAt: new Date(String(row.accepted_terms_at)).toISOString(),
    isDemo: Boolean(row.is_demo),
    isAdmin: Boolean(row.is_admin),
    isSuspended: Boolean(row.is_suspended),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function rowToWorkspace(row: Record<string, unknown>): StoredWorkspace {
  const rawSettings =
    row.alert_settings && typeof row.alert_settings === 'object'
      ? (row.alert_settings as Partial<AlertSettingsShape>)
      : {};
  return {
    transactions: Array.isArray(row.transactions) ? row.transactions : [],
    budgets: Array.isArray(row.budgets) ? row.budgets : [],
    goals: Array.isArray(row.goals) ? row.goals : [],
    currency: row.currency === 'USD' ? 'USD' : 'MZN',
    isBalanceHidden: Boolean(row.is_balance_hidden),
    alertSettings: {
      ...DEFAULT_ALERT_SETTINGS,
      ...rawSettings,
    },
    readAlertSignatures: Array.isArray(row.read_alert_signatures)
      ? row.read_alert_signatures.filter((x): x is string => typeof x === 'string')
      : [],
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function rowToSupportTicket(row: Record<string, unknown>): StoredSupportTicket {
  return {
    id: String(row.id),
    code: String(row.code),
    userId: String(row.user_id),
    userName: String(row.user_name),
    userPhone: String(row.user_phone),
    userEmail: String(row.user_email ?? ''),
    subject: String(row.subject),
    category: String(row.category),
    contactChannel: String(row.contact_channel),
    message: String(row.message),
    status: 'aberto',
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function rowToSubscription(row: Record<string, unknown>): StoredSubscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    plan: (row.plan === 'pro' || row.plan === 'business' ? row.plan : 'free') as SubscriptionPlan,
    status: (row.status === 'canceled' || row.status === 'past_due' || row.status === 'trialing'
      ? row.status
      : 'active') as SubscriptionStatus,
    billingCycle: row.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
    currency: row.currency === 'USD' ? 'USD' : 'MZN',
    pricePaid: Number(row.price_paid ?? 0),
    paymentMethod: String(row.payment_method ?? 'free'),
    paymentPhone: String(row.payment_phone ?? ''),
    paymentReference: String(row.payment_reference ?? ''),
    startedAt: new Date(String(row.started_at)).toISOString(),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

async function ensureSubscription(userId: string): Promise<StoredSubscription> {
  const pool = getPool();
  const defaultSubId = `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const nowIso = new Date().toISOString();

  await pool.query(
    `INSERT INTO subscriptions (
      id, user_id, plan, status, billing_cycle, currency, price_paid, payment_method, payment_phone, payment_reference, started_at, expires_at, created_at, updated_at
    ) VALUES ($1, $2, 'free', 'active', 'monthly', 'MZN', 0, 'free', '', '', $3, NULL, $3, $3)
    ON CONFLICT (user_id) DO NOTHING`,
    [defaultSubId, userId, nowIso]
  );

  const res = await pool.query(`SELECT * FROM subscriptions WHERE user_id = $1`, [userId]);
  if (res.rows[0]) {
    return rowToSubscription(res.rows[0]);
  }
  return {
    id: defaultSubId,
    userId,
    plan: 'free',
    status: 'active',
    billingCycle: 'monthly',
    currency: 'MZN',
    pricePaid: 0,
    paymentMethod: 'free',
    paymentPhone: '',
    paymentReference: '',
    startedAt: nowIso,
    expiresAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function ensureWorkspace(userId: string): Promise<StoredWorkspace> {
  const pool = getPool();
  const empty = createEmptyWorkspace();
  await pool.query(
    `INSERT INTO workspaces (
      user_id, transactions, budgets, goals, currency, is_balance_hidden, alert_settings, read_alert_signatures, updated_at
    ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, $9)
    ON CONFLICT (user_id) DO NOTHING`,
    [
      userId,
      JSON.stringify(empty.transactions),
      JSON.stringify(empty.budgets),
      JSON.stringify(empty.goals),
      empty.currency,
      empty.isBalanceHidden,
      JSON.stringify(empty.alertSettings),
      JSON.stringify(empty.readAlertSignatures),
      empty.updatedAt,
    ]
  );

  const res = await pool.query(
    `SELECT user_id, transactions, budgets, goals, currency, is_balance_hidden, alert_settings, read_alert_signatures, updated_at
     FROM workspaces
     WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0] ? rowToWorkspace(res.rows[0]) : empty;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.length === 9 && /^8[2-7]/.test(digits)) {
    return `258${digits}`;
  }
  return digits;
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function signTokenId(tokenId: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(tokenId).digest('hex');
}

async function createSessionToken(userId: string): Promise<string> {
  const pool = getPool();
  const now = Date.now();
  await pool.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);

  const tokenId = crypto.randomBytes(24).toString('hex');
  const expiresAt = now + SESSION_TTL_MS;
  await pool.query(
    'INSERT INTO sessions (token_id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [tokenId, userId, now, expiresAt]
  );

  return `${tokenId}.${signTokenId(tokenId)}`;
}

async function verifySessionToken(
  token: string
): Promise<{ tokenId: string; user: StoredUser } | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [tokenId, sig] = parts;
  if (!tokenId || !sig || sig.length !== 64) return null;

  const expectedSig = signTokenId(tokenId);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const now = Date.now();
  const res = await getPool().query(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_id = $1 AND s.expires_at > $2`,
    [tokenId, now]
  );
  if (!res.rows[0]) return null;
  return { tokenId, user: rowToUser(res.rows[0]) };
}

async function sanitizeUser(user: StoredUser) {
  let avatarDataUrl = user.avatarDataUrl;
  if (
    user.avatarS3Key &&
    user.avatarS3Key.startsWith(`avatars/${user.id}/`) &&
    isStorageConfigured()
  ) {
    try {
      avatarDataUrl = await getPresignedObjectUrl(user.avatarS3Key, 3600);
    } catch (err) {
      console.error('Failed to presign avatar URL:', err);
    }
  }

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    address: user.address,
    avatarDataUrl,
    isDemo: user.isDemo,
    isAdmin: user.isAdmin,
    isSuspended: user.isSuspended,
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
  };
}

function parseAvatarDataUrl(
  val: string
): { valid: boolean; ext?: string; mime?: string; buffer?: Buffer } {
  if (val === '') return { valid: true };
  if (val.length > 350_000) return { valid: false };
  const match = /^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(val);
  if (!match) return { valid: false };
  const mime = match[1];
  const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
  return {
    valid: true,
    mime,
    ext,
    buffer: Buffer.from(match[3], 'base64'),
  };
}

function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão não autenticada. Faça login para continuar.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const verified = await verifySessionToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente.' });
    return;
  }
  req.authUser = verified.user;
  req.authTokenId = verified.tokenId;
  next();
});

const requireAdmin = asyncHandler(async (req, res, next) => {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: 'Autenticação necessária.' });
    return;
  }
  const adminPhone = (process.env.ADMIN_PHONE ?? '').replace(/\D/g, '');
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const isEnvAdmin =
    (adminPhone && user.phoneNormalized === adminPhone) ||
    (adminEmail && user.emailNormalized === adminEmail);

  // If user is explicitly flagged as admin or matches admin env or is a local developer/demo admin
  if (!user.isAdmin && !isEnvAdmin && !user.isDemo) {
    res.status(403).json({
      error: 'Acesso negado. Apenas administradores do FinTrack SaaS podem aceder a esta área.',
    });
    return;
  }
  next();
});

const ALLOWED_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'http://localhost:3000',
  'capacitor://localhost',
  'https://fin-pro-livid.vercel.app',
]);

/**
 * Creates the Express application with all FinTrack `/api/*` routes and security middleware.
 */
export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  const loginRateLimiter = new LoginRateLimiter();

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '512kb' }));

  app.use(
    '/api',
    asyncHandler(async (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Vary', 'Authorization');
      if (!isDatabaseConfigured()) {
        res.status(503).json({
          error: 'Banco de dados Neon não configurado no servidor (variável DATABASE_URL em falta).',
        });
        return;
      }
      await ensureDbInitialized();
      next();
    })
  );

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      await getPool().query('SELECT 1');
      res.json({
        ok: true,
        database: 'neon-postgres',
        storageConfigured: isStorageConfigured(),
        bucket: S3_BUCKET,
      });
    })
  );

  // Register a real user account
  app.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const body = req.body as Record<string, unknown>;
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
      const email = typeof body?.email === 'string' ? body.email.trim() : '';
      const address = typeof body?.address === 'string' ? body.address.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const confirmPassword =
        typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';
      const acceptedTerms = body?.acceptedTerms === true;

      if (name.length < 2 || name.length > 100) {
        res.status(400).json({ error: 'Informe o seu nome completo (mínimo 2 caracteres).' });
        return;
      }

      const phoneNormalized = normalizePhone(phone);
      if (phoneNormalized.length < 9 || phoneNormalized.length > 15) {
        res.status(400).json({
          error:
            'Informe um número de telemóvel válido (mínimo 9 dígitos, ex: +258 84 123 4567).',
        });
        return;
      }

      if (email && (!isValidEmailFormat(email) || email.length > 120)) {
        res.status(400).json({ error: 'O e-mail informado não é válido.' });
        return;
      }

      if (address.length < 3 || address.length > 200) {
        res.status(400).json({ error: 'Informe o seu endereço (ex: Bairro, Cidade).' });
        return;
      }

      if (password.length < 6 || password.length > 128) {
        res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({ error: 'A senha e a confirmação de senha não coincidem.' });
        return;
      }

      if (!acceptedTerms) {
        res.status(400).json({
          error: 'É obrigatório concordar com os Termos de Uso e Política de Privacidade.',
        });
        return;
      }

      const emailNormalized = email.toLowerCase();

      const existingPhone = await pool.query(
        'SELECT id FROM users WHERE phone_normalized = $1 LIMIT 1',
        [phoneNormalized]
      );
      if (existingPhone.rows.length > 0) {
        res.status(409).json({ error: 'Este número de telemóvel já está cadastrado.' });
        return;
      }

      if (emailNormalized) {
        const existingEmail = await pool.query(
          'SELECT id FROM users WHERE email_normalized = $1 LIMIT 1',
          [emailNormalized]
        );
        if (existingEmail.rows.length > 0) {
          res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
          return;
        }
      }

      const nowIso = new Date().toISOString();
      const userId = `usr_${crypto.randomUUID()}`;
      const passwordHash = hashPassword(password);

      const userRes = await pool.query(
        `INSERT INTO users (
          id, name, phone, phone_normalized, email, email_normalized, address,
          avatar_data_url, avatar_s3_key, password_hash, accepted_terms_at, is_demo, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, '', '', $8, $9, FALSE, $9, $9)
        RETURNING *`,
        [
          userId,
          name,
          phone,
          phoneNormalized,
          email,
          emailNormalized,
          address,
          passwordHash,
          nowIso,
        ]
      );

      const newUser = rowToUser(userRes.rows[0]);
      const workspace = await ensureWorkspace(userId);
      const token = await createSessionToken(userId);

      res.status(201).json({
        token,
        user: await sanitizeUser(newUser),
        workspace,
      });
    })
  );

  // Real login via phone number OR email + password
  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const body = req.body as Record<string, unknown>;
      const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';

      if (!identifier || !password) {
        res.status(400).json({ error: 'Informe o número/e-mail e a sua senha.' });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || '';
      const rateCheck = loginRateLimiter.check(identifier, clientIp);
      if (!rateCheck.allowed) {
        res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
        res.status(429).json({
          error: 'Muitas tentativas falhadas. Aguarde alguns minutos antes de tentar novamente.',
        });
        return;
      }

      const lower = identifier.toLowerCase();
      const normPhone = normalizePhone(identifier);

      const userRes = await pool.query(
        `SELECT *
         FROM users
         WHERE (email_normalized <> '' AND email_normalized = $1)
            OR ($2 <> '' AND LENGTH($2) >= 9 AND phone_normalized = $2)
         LIMIT 1`,
        [lower, normPhone]
      );

      const user = userRes.rows[0] ? rowToUser(userRes.rows[0]) : null;
      const passwordOk = user
        ? verifyPassword(password, user.passwordHash)
        : (crypto.scryptSync(password, '00000000000000000000000000000000', 64), false);

      if (!user || !passwordOk) {
        loginRateLimiter.recordFailure(identifier, clientIp);
        res.status(401).json({ error: 'Número/e-mail ou senha incorretos.' });
        return;
      }

      if (user.isSuspended) {
        res.status(403).json({
          error:
            'A sua conta foi temporariamente suspensa pela administração do FinTrack. Contacte o suporte.',
        });
        return;
      }

      loginRateLimiter.reset(identifier, clientIp);

      const workspace = await ensureWorkspace(user.id);
      const token = await createSessionToken(user.id);

      res.json({
        token,
        user: await sanitizeUser(user),
        workspace,
      });
    })
  );

  app.post(
    '/api/auth/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (req.authTokenId) {
        await getPool().query('DELETE FROM sessions WHERE token_id = $1', [req.authTokenId]);
      }
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/auth/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.authUser!;
      const workspace = await ensureWorkspace(user.id);
      res.json({
        user: await sanitizeUser(user),
        workspace,
      });
    })
  );

  // Update profile data & avatar upload (uses Neon Object Storage S3 when configured)
  app.patch(
    '/api/profile',
    requireAuth,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const user = req.authUser!;
      const body = req.body as Record<string, unknown>;

      const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.id]);
      if (!targetRes.rows[0]) {
        res.status(404).json({ error: 'Utilizador não encontrado.' });
        return;
      }
      const target = rowToUser(targetRes.rows[0]);

      if (typeof body.name === 'string') {
        const trimmed = body.name.trim();
        if (trimmed.length < 2 || trimmed.length > 100) {
          res.status(400).json({ error: 'O nome deve ter entre 2 e 100 caracteres.' });
          return;
        }
        target.name = trimmed;
      }

      if (typeof body.phone === 'string') {
        const trimmedPhone = body.phone.trim();
        const norm = normalizePhone(trimmedPhone);
        if (norm.length < 9 || norm.length > 15) {
          res.status(400).json({ error: 'Informe um número de telemóvel válido.' });
          return;
        }
        const dupPhone = await pool.query(
          'SELECT id FROM users WHERE id <> $1 AND phone_normalized = $2 LIMIT 1',
          [target.id, norm]
        );
        if (dupPhone.rows.length > 0) {
          res.status(409).json({ error: 'Este número já está associado a outra conta.' });
          return;
        }
        target.phone = trimmedPhone;
        target.phoneNormalized = norm;
      }

      if (typeof body.email === 'string') {
        const trimmedEmail = body.email.trim();
        if (trimmedEmail && (!isValidEmailFormat(trimmedEmail) || trimmedEmail.length > 120)) {
          res.status(400).json({ error: 'Formato de e-mail inválido.' });
          return;
        }
        const normEmail = trimmedEmail.toLowerCase();
        if (normEmail) {
          const dupEmail = await pool.query(
            'SELECT id FROM users WHERE id <> $1 AND email_normalized = $2 LIMIT 1',
            [target.id, normEmail]
          );
          if (dupEmail.rows.length > 0) {
            res.status(409).json({ error: 'Este e-mail já está em uso por outra conta.' });
            return;
          }
        }
        target.email = trimmedEmail;
        target.emailNormalized = normEmail;
      }

      if (typeof body.address === 'string') {
        const trimmedAddress = body.address.trim();
        if (trimmedAddress.length < 3 || trimmedAddress.length > 200) {
          res.status(400).json({ error: 'O endereço deve ter pelo menos 3 caracteres.' });
          return;
        }
        target.address = trimmedAddress;
      }

      if (typeof body.avatarDataUrl === 'string') {
        const parsed = parseAvatarDataUrl(body.avatarDataUrl);
        if (!parsed.valid) {
          res.status(400).json({
            error: 'Foto inválida. Use uma imagem PNG, JPG ou WebP com tamanho reduzido.',
          });
          return;
        }

        const previousS3Key = target.avatarS3Key;

        if (body.avatarDataUrl === '') {
          target.avatarDataUrl = '';
          target.avatarS3Key = '';
          if (previousS3Key && isStorageConfigured()) {
            await deleteObject(previousS3Key).catch(() => {});
          }
        } else if (parsed.buffer && parsed.ext && isStorageConfigured()) {
          const newKey = `avatars/${target.id}/${crypto.randomUUID()}.${parsed.ext}`;
          await uploadObject(newKey, parsed.buffer, parsed.mime);
          target.avatarS3Key = newKey;
          target.avatarDataUrl = '';
          if (previousS3Key) {
            await deleteObject(previousS3Key).catch(() => {});
          }
        } else {
          target.avatarDataUrl = body.avatarDataUrl;
          target.avatarS3Key = '';
        }
      }

      const nowIso = new Date().toISOString();
      await pool.query(
        `UPDATE users
         SET name = $1,
             phone = $2,
             phone_normalized = $3,
             email = $4,
             email_normalized = $5,
             address = $6,
             avatar_data_url = $7,
             avatar_s3_key = $8,
             updated_at = $9
         WHERE id = $10`,
        [
          target.name,
          target.phone,
          target.phoneNormalized,
          target.email,
          target.emailNormalized,
          target.address,
          target.avatarDataUrl,
          target.avatarS3Key,
          nowIso,
          target.id,
        ]
      );

      let workspace = await ensureWorkspace(target.id);
      if (body.currency === 'MZN' || body.currency === 'USD') {
        const wsRes = await pool.query(
          `UPDATE workspaces
           SET currency = $1, updated_at = $2
           WHERE user_id = $3
           RETURNING *`,
          [body.currency, nowIso, target.id]
        );
        if (wsRes.rows[0]) {
          workspace = rowToWorkspace(wsRes.rows[0]);
        }
      }

      res.json({
        user: await sanitizeUser(target),
        workspace,
      });
    })
  );

  // Change password (verifies current password and revokes other sessions)
  app.post(
    '/api/profile/password',
    requireAuth,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const user = req.authUser!;
      const body = req.body as Record<string, unknown>;
      const currentPassword =
        typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
      const confirmPassword =
        typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

      if (newPassword.length < 6 || newPassword.length > 128) {
        res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'A nova senha e a confirmação não coincidem.' });
        return;
      }

      const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [user.id]);
      if (!targetRes.rows[0]) {
        res.status(404).json({ error: 'Utilizador não encontrado.' });
        return;
      }
      const target = rowToUser(targetRes.rows[0]);

      if (target.passwordHash) {
        if (!currentPassword || !verifyPassword(currentPassword, target.passwordHash)) {
          res.status(401).json({ error: 'A senha atual está incorreta.' });
          return;
        }
      }

      target.passwordHash = hashPassword(newPassword);
      const nowIso = new Date().toISOString();
      await pool.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
        target.passwordHash,
        nowIso,
        target.id,
      ]);

      if (req.authTokenId) {
        await pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_id <> $2', [
          target.id,
          req.authTokenId,
        ]);
      }

      res.json({ ok: true, user: await sanitizeUser(target) });
    })
  );

  // Save authenticated user's financial workspace
  app.put(
    '/api/workspace',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.authUser!;
      const body = req.body as Record<string, unknown>;

      const existing = await ensureWorkspace(user.id);

      const nextWorkspace: StoredWorkspace = {
        transactions: Array.isArray(body.transactions) ? body.transactions : existing.transactions,
        budgets: Array.isArray(body.budgets) ? body.budgets : existing.budgets,
        goals: Array.isArray(body.goals) ? body.goals : existing.goals,
        currency:
          body.currency === 'MZN' || body.currency === 'USD' ? body.currency : existing.currency,
        isBalanceHidden:
          typeof body.isBalanceHidden === 'boolean'
            ? body.isBalanceHidden
            : existing.isBalanceHidden,
        alertSettings:
          body.alertSettings && typeof body.alertSettings === 'object'
            ? {
                ...existing.alertSettings,
                ...(body.alertSettings as Partial<AlertSettingsShape>),
              }
            : existing.alertSettings,
        readAlertSignatures: Array.isArray(body.readAlertSignatures)
          ? body.readAlertSignatures.filter((x): x is string => typeof x === 'string')
          : existing.readAlertSignatures,
        updatedAt: new Date().toISOString(),
      };

      await getPool().query(
        `INSERT INTO workspaces (
          user_id, transactions, budgets, goals, currency, is_balance_hidden, alert_settings, read_alert_signatures, updated_at
        ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, $9)
        ON CONFLICT (user_id) DO UPDATE SET
          transactions = EXCLUDED.transactions,
          budgets = EXCLUDED.budgets,
          goals = EXCLUDED.goals,
          currency = EXCLUDED.currency,
          is_balance_hidden = EXCLUDED.is_balance_hidden,
          alert_settings = EXCLUDED.alert_settings,
          read_alert_signatures = EXCLUDED.read_alert_signatures,
          updated_at = EXCLUDED.updated_at`,
        [
          user.id,
          JSON.stringify(nextWorkspace.transactions),
          JSON.stringify(nextWorkspace.budgets),
          JSON.stringify(nextWorkspace.goals),
          nextWorkspace.currency,
          nextWorkspace.isBalanceHidden,
          JSON.stringify(nextWorkspace.alertSettings),
          JSON.stringify(nextWorkspace.readAlertSignatures),
          nextWorkspace.updatedAt,
        ]
      );

      res.json({ workspace: nextWorkspace });
    })
  );

  // Submit a real support ticket
  app.post(
    '/api/support',
    requireAuth,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const user = req.authUser!;
      const body = req.body as Record<string, unknown>;
      const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
      const category = typeof body?.category === 'string' ? body.category.trim() : 'Geral';
      const contactChannel =
        typeof body?.contactChannel === 'string' ? body.contactChannel.trim() : 'WhatsApp';
      const message = typeof body?.message === 'string' ? body.message.trim() : '';

      if (subject.length < 3 || subject.length > 120) {
        res.status(400).json({ error: 'Informe um assunto com pelo menos 3 caracteres.' });
        return;
      }
      if (message.length < 8 || message.length > 1500) {
        res.status(400).json({ error: 'Descreva a sua solicitação com pelo menos 8 caracteres.' });
        return;
      }

      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const code = `FT-${new Date().getFullYear()}-${suffix}`;
      const id = `sup_${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();

      const ticketRes = await pool.query(
        `INSERT INTO support_tickets (
          id, code, user_id, user_name, user_phone, user_email, subject, category, contact_channel, message, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'aberto', $11)
        RETURNING *`,
        [
          id,
          code,
          user.id,
          user.name,
          user.phone,
          user.email,
          subject,
          category.slice(0, 60),
          contactChannel.slice(0, 40),
          message,
          nowIso,
        ]
      );

      res.status(201).json({ ticket: rowToSupportTicket(ticketRes.rows[0]) });
    })
  );

  // List support tickets for the authenticated user
  app.get(
    '/api/support',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.authUser!;
      const ticketsRes = await getPool().query(
        'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
        [user.id]
      );
      res.json({ tickets: ticketsRes.rows.map(rowToSupportTicket) });
    })
  );

  // Get current user's subscription and SaaS limits
  app.get(
    '/api/subscription',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.authUser!;
      if (user.isAdmin) {
        res.json({
          ok: true,
          subscription: null,
          isAdmin: true,
          limits: PLAN_LIMITS.business,
          usage: {
            transactionsThisMonth: 0,
            budgetsCount: 0,
            goalsCount: 0,
          },
        });
        return;
      }

      const subscription = await ensureSubscription(user.id);
      const ws = await ensureWorkspace(user.id);

      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const transactions = Array.isArray(ws.transactions)
        ? (ws.transactions as Array<{ date?: string }>)
        : [];
      const transactionsThisMonth = transactions.filter(
        (t) => typeof t.date === 'string' && t.date.startsWith(currentYearMonth)
      ).length;

      const limits = PLAN_LIMITS[subscription.plan] ?? PLAN_LIMITS.free;

      res.json({
        ok: true,
        subscription,
        limits,
        usage: {
          transactionsThisMonth,
          budgetsCount: Array.isArray(ws.budgets) ? ws.budgets.length : 0,
          goalsCount: Array.isArray(ws.goals) ? ws.goals.length : 0,
        },
      });
    })
  );

  // Upgrade or change subscription plan (SaaS Checkout)
  app.post(
    '/api/subscription/upgrade',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.authUser!;
      const rawPlan = req.body?.plan;
      const paymentMethod = String(req.body?.paymentMethod ?? 'mpesa').toLowerCase();
      const rawPhone = String(req.body?.phone ?? user.phone ?? '').trim();
      const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';

      if (rawPlan !== 'pro' && rawPlan !== 'business' && rawPlan !== 'free') {
        res.status(400).json({
          error: 'Plano inválido selecionado. Opções válidas: free, pro, business.',
        });
        return;
      }

      const plan: SubscriptionPlan = rawPlan;
      let price = 0;
      if (plan === 'pro') {
        price = billingCycle === 'yearly' ? 2490 : 299;
      } else if (plan === 'business') {
        price = billingCycle === 'yearly' ? 6990 : 799;
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const expiresAt = new Date(now);
      if (billingCycle === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      const prefix = paymentMethod === 'emola' ? 'EM' : paymentMethod === 'card' ? 'CARD' : 'MP';
      const reference = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

      const pool = getPool();
      await ensureSubscription(user.id);

      const updateRes = await pool.query(
        `UPDATE subscriptions
         SET plan = $1,
             status = 'active',
             billing_cycle = $2,
             price_paid = $3,
             payment_method = $4,
             payment_phone = $5,
             payment_reference = $6,
             started_at = $7,
             expires_at = $8,
             updated_at = $7
         WHERE user_id = $9
         RETURNING *`,
        [
          plan,
          billingCycle,
          price,
          paymentMethod,
          rawPhone,
          reference,
          nowIso,
          plan === 'free' ? null : expiresAt.toISOString(),
          user.id,
        ]
      );

      const updated = updateRes.rows[0]
        ? rowToSubscription(updateRes.rows[0])
        : await ensureSubscription(user.id);

      res.json({
        ok: true,
        subscription: updated,
        message:
          plan === 'free'
            ? 'Plano Gratuito ativo com sucesso.'
            : `Assinatura ${plan.toUpperCase()} ativada com sucesso via ${paymentMethod.toUpperCase()} (Ref: ${reference})!`,
      });
    })
  );

  // SaaS Admin: Overview Metrics (Valores 100% Reais do Banco de Dados)
  app.get(
    '/api/admin/overview',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const usersCountRes = await pool.query('SELECT COUNT(*) AS count FROM users WHERE is_admin = FALSE');
      const subsRes = await pool.query(
        `SELECT plan, status, COUNT(*) AS count, COALESCE(SUM(price_paid), 0) AS total_paid
         FROM subscriptions
         GROUP BY plan, status`
      );
      const mrrRes = await pool.query(
        `SELECT COALESCE(SUM(price_paid), 0) AS mrr
         FROM subscriptions
         WHERE status = 'active'`
      );
      const openTicketsRes = await pool.query(
        `SELECT COUNT(*) AS count FROM support_tickets WHERE status = 'aberto'`
      );

      // Faturamento real diário dos últimos 7 dias (sem dados simulados)
      const weeklyRes = await pool.query(
        `SELECT EXTRACT(DOW FROM updated_at) AS dow, COALESCE(SUM(price_paid), 0) AS total
         FROM subscriptions
         WHERE status = 'active' AND updated_at >= NOW() - INTERVAL '7 days'
         GROUP BY EXTRACT(DOW FROM updated_at)`
      );

      const weeklyByDow: Record<number, number> = {};
      for (const row of weeklyRes.rows) {
        weeklyByDow[Number(row.dow)] = Number(row.total ?? 0);
      }

      const days = [
        { label: 'Dom', dow: 0 },
        { label: 'Seg', dow: 1 },
        { label: 'Ter', dow: 2 },
        { label: 'Qua', dow: 3 },
        { label: 'Qui', dow: 4 },
        { label: 'Sex', dow: 5 },
        { label: 'Sáb', dow: 6 },
      ];
      const realWeeklyRevenue = days.map((d) => ({
        label: d.label,
        val: weeklyByDow[d.dow] ?? 0,
      }));

      let proCount = 0;
      let businessCount = 0;
      let freeCount = 0;

      for (const row of subsRes.rows) {
        const count = Number(row.count ?? 0);
        if (row.plan === 'pro') proCount += count;
        else if (row.plan === 'business') businessCount += count;
        else freeCount += count;
      }

      const totalUsers = Number(usersCountRes.rows[0]?.count ?? 0);
      const mrrMzn = Number(mrrRes.rows[0]?.mrr ?? 0);

      res.json({
        ok: true,
        stats: {
          totalUsers,
          totalSubscriptions: proCount + businessCount + freeCount,
          proUsersCount: proCount,
          businessUsersCount: businessCount,
          freeUsersCount: freeCount,
          mrrMzn,
          weeklyRevenue: realWeeklyRevenue,
          openTicketsCount: Number(openTicketsRes.rows[0]?.count ?? 0),
        },
      });
    })
  );

  // SaaS Admin: Users & Subscriptions List
  app.get(
    '/api/admin/users',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const rowsRes = await pool.query(
        `SELECT u.id, u.name, u.phone, u.email, u.is_admin, COALESCE(u.is_suspended, FALSE) AS is_suspended, u.created_at,
                COALESCE(s.plan, 'free') AS plan,
                COALESCE(s.status, 'active') AS status,
                COALESCE(s.payment_method, 'free') AS payment_method,
                COALESCE(s.payment_reference, '') AS payment_reference,
                COALESCE(s.billing_cycle, 'monthly') AS billing_cycle
         FROM users u
         LEFT JOIN subscriptions s ON u.id = s.user_id
         ORDER BY u.created_at DESC
         LIMIT 100`
      );

      const users = rowsRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        phone: String(r.phone),
        email: String(r.email ?? ''),
        isAdmin: Boolean(r.is_admin),
        isSuspended: Boolean(r.is_suspended),
        createdAt: new Date(String(r.created_at)).toISOString(),
        plan: String(r.plan),
        status: String(r.status),
        paymentMethod: String(r.payment_method),
        paymentReference: String(r.payment_reference),
        billingCycle: String(r.billing_cycle),
      }));

      res.json({ ok: true, users });
    })
  );

  // SaaS Admin: Update a User's Plan Manually
  app.post(
    '/api/admin/users/plan',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const targetId = String(req.body?.targetId ?? '').trim();
      const nextPlan = String(req.body?.plan ?? 'free').toLowerCase();

      if (!targetId) {
        res.status(400).json({ error: 'ID de utilizador alvo não informado.' });
        return;
      }
      if (nextPlan !== 'free' && nextPlan !== 'pro' && nextPlan !== 'business') {
        res.status(400).json({ error: 'Plano inválido.' });
        return;
      }

      await ensureSubscription(targetId);
      const updateRes = await pool.query(
        `UPDATE subscriptions
         SET plan = $1, status = 'active', updated_at = NOW()
         WHERE user_id = $2
         RETURNING *`,
        [nextPlan, targetId]
      );

      res.json({
        ok: true,
        subscription: updateRes.rows[0] ? rowToSubscription(updateRes.rows[0]) : null,
        message: `Plano do utilizador alterado para ${nextPlan.toUpperCase()}.`,
      });
    })
  );

  // SaaS Admin: List all support tickets
  app.get(
    '/api/admin/tickets',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const resTickets = await pool.query(
        `SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 100`
      );
      res.json({ ok: true, tickets: resTickets.rows.map(rowToSupportTicket) });
    })
  );

  // SaaS Admin: Update support ticket status
  app.post(
    '/api/admin/tickets/status',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const ticketId = String(req.body?.ticketId ?? '').trim();
      const status = String(req.body?.status ?? 'fechado').trim();
      if (!ticketId) {
        res.status(400).json({ error: 'ID do bilhete em falta.' });
        return;
      }
      await pool.query(
        `UPDATE support_tickets SET status = $1 WHERE id = $2`,
        [status, ticketId]
      );
      res.json({ ok: true, message: `Estado do bilhete atualizado para ${status}.` });
    })
  );

  // SaaS Admin: Suspend or Reactivate a User Account
  app.post(
    '/api/admin/users/status',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const targetId = String(req.body?.targetId ?? '').trim();
      const isSuspended = Boolean(req.body?.isSuspended);

      if (!targetId) {
        res.status(400).json({ error: 'ID de utilizador alvo não informado.' });
        return;
      }

      await pool.query(
        `UPDATE users SET is_suspended = $1, updated_at = NOW() WHERE id = $2`,
        [isSuspended, targetId]
      );

      res.json({
        ok: true,
        message: isSuspended ? 'Conta do utilizador suspensa com sucesso.' : 'Conta do utilizador reativada.',
      });
    })
  );

  // SaaS Admin: Reset a Customer's Password
  app.post(
    '/api/admin/users/reset-password',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const targetId = String(req.body?.targetId ?? '').trim();
      const newPassword = String(req.body?.newPassword ?? '').trim();

      if (!targetId || newPassword.length < 6) {
        res.status(400).json({ error: 'ID inválido ou nova senha com menos de 6 caracteres.' });
        return;
      }

      const hash = hashPassword(newPassword);
      await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hash, targetId]
      );

      res.json({ ok: true, message: 'Senha do utilizador redefinida com sucesso!' });
    })
  );

  // SaaS Admin: List all subscriptions & M-Pesa payments
  app.get(
    '/api/admin/subscriptions',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const rows = await pool.query(
        `SELECT s.*, u.name AS user_name, u.phone AS user_phone, u.email AS user_email
         FROM subscriptions s
         JOIN users u ON s.user_id = u.id
         ORDER BY s.updated_at DESC
         LIMIT 100`
      );

      const subscriptions = rows.rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        userName: String(r.user_name),
        userPhone: String(r.user_phone),
        userEmail: String(r.user_email ?? ''),
        plan: String(r.plan),
        status: String(r.status),
        billingCycle: String(r.billing_cycle),
        currency: String(r.currency),
        pricePaid: Number(r.price_paid ?? 0),
        paymentMethod: String(r.payment_method),
        paymentPhone: String(r.payment_phone ?? ''),
        paymentReference: String(r.payment_reference ?? ''),
        startedAt: new Date(String(r.started_at)).toISOString(),
        expiresAt: r.expires_at ? new Date(String(r.expires_at)).toISOString() : null,
      }));

      res.json({ ok: true, subscriptions });
    })
  );

  // SaaS Admin: Approve Payment & Activate Subscription
  app.post(
    '/api/admin/subscriptions/approve',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const targetId = String(req.body?.targetId ?? '').trim();
      const plan = String(req.body?.plan ?? 'pro').toLowerCase();
      const cycle = String(req.body?.billingCycle ?? 'monthly').toLowerCase();
      const days = cycle === 'yearly' ? 365 : 30;

      if (!targetId) {
        res.status(400).json({ error: 'ID de utilizador alvo não informado.' });
        return;
      }

      await ensureSubscription(targetId);
      await pool.query(
        `UPDATE subscriptions
         SET plan = $1,
             status = 'active',
             billing_cycle = $2,
             expires_at = NOW() + ($3 || ' days')::interval,
             updated_at = NOW()
         WHERE user_id = $4`,
        [plan, cycle, String(days), targetId]
      );

      res.json({
        ok: true,
        message: `Subscrição aprovada! Plano ${plan.toUpperCase()} ativado por ${days} dias.`,
      });
    })
  );

  // SaaS Admin: Global Announcements (Broadcast)
  app.get(
    '/api/admin/announcements',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const resAnn = await pool.query(
        `SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50`
      );
      res.json({
        ok: true,
        announcements: resAnn.rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          message: String(r.message),
          severity: String(r.severity),
          isActive: Boolean(r.is_active),
          createdAt: new Date(String(r.created_at)).toISOString(),
        })),
      });
    })
  );

  app.post(
    '/api/admin/announcements',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const title = String(req.body?.title ?? '').trim();
      const message = String(req.body?.message ?? '').trim();
      const severity = String(req.body?.severity ?? 'info').trim();

      if (!title || !message) {
        res.status(400).json({ error: 'Título e mensagem do comunicado são obrigatórios.' });
        return;
      }

      const id = `ann_${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO announcements (id, title, message, severity, is_active, created_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())`,
        [id, title, message, severity]
      );

      res.json({ ok: true, message: 'Comunicado global publicado com sucesso!' });
    })
  );

  app.delete(
    '/api/admin/announcements/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const id = String(req.params.id ?? '').trim();
      await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
      res.json({ ok: true, message: 'Comunicado removido.' });
    })
  );

  // Public/Client Announcements for all apps
  app.get(
    '/api/announcements',
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const resAnn = await pool.query(
        `SELECT id, title, message, severity, created_at
         FROM announcements
         WHERE is_active = TRUE
         ORDER BY created_at DESC
         LIMIT 5`
      );
      res.json({
        ok: true,
        announcements: resAnn.rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          message: String(r.message),
          severity: String(r.severity),
          createdAt: new Date(String(r.created_at)).toISOString(),
        })),
      });
    })
  );

  // SaaS Admin: Toggle User Account Status (Active vs Suspended)
  app.post(
    '/api/admin/users/status',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const targetId = String(req.body?.targetId ?? '').trim();
      const isSuspended = Boolean(req.body?.isSuspended);

      if (!targetId) {
        res.status(400).json({ error: 'ID de utilizador alvo não informado.' });
        return;
      }

      await pool.query(
        `UPDATE users SET is_suspended = $1, updated_at = NOW() WHERE id = $2`,
        [isSuspended, targetId]
      );

      res.json({
        ok: true,
        message: isSuspended ? 'Conta do utilizador suspensa com sucesso.' : 'Conta do utilizador reativada.',
      });
    })
  );

  // SaaS Admin: Reset User Password
  app.post(
    '/api/admin/users/reset-password',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const targetId = String(req.body?.targetId ?? '').trim();
      const newPassword = String(req.body?.newPassword ?? '').trim();

      if (!targetId || newPassword.length < 6) {
        res.status(400).json({ error: 'ID inválido ou nova senha com menos de 6 caracteres.' });
        return;
      }

      const hash = hashPassword(newPassword);
      await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hash, targetId]
      );

      res.json({ ok: true, message: 'Senha do utilizador redefinida com sucesso!' });
    })
  );

  // SaaS Admin: List all subscriptions & M-Pesa payments
  app.get(
    '/api/admin/subscriptions',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const rows = await pool.query(
        `SELECT s.id, s.user_id, s.plan, s.status, s.billing_cycle, s.currency, s.price_paid,
                s.payment_method, s.payment_phone, s.payment_reference, s.started_at, s.expires_at,
                u.name AS user_name, u.phone AS user_phone, u.email AS user_email
         FROM subscriptions s
         JOIN users u ON s.user_id = u.id
         ORDER BY s.updated_at DESC
         LIMIT 100`
      );

      const subscriptions = rows.rows.map((r) => ({
        id: String(r.id),
        targetId: String(r.user_id),
        userName: String(r.user_name),
        userPhone: String(r.user_phone),
        userEmail: String(r.user_email ?? ''),
        plan: String(r.plan),
        status: String(r.status),
        billingCycle: String(r.billing_cycle),
        currency: String(r.currency),
        pricePaid: Number(r.price_paid ?? 0),
        paymentMethod: String(r.payment_method),
        paymentPhone: String(r.payment_phone ?? ''),
        paymentReference: String(r.payment_reference ?? ''),
        startedAt: new Date(String(r.started_at)).toISOString(),
        expiresAt: r.expires_at ? new Date(String(r.expires_at)).toISOString() : null,
      }));

      res.json({ ok: true, subscriptions });
    })
  );

  // SaaS Admin: Approve M-Pesa / e-Mola Payment & Activate Plan
  app.post(
    '/api/admin/subscriptions/approve',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const targetId = String(req.body?.targetId ?? '').trim();
      const plan = String(req.body?.plan ?? 'pro').toLowerCase();
      const cycle = String(req.body?.billingCycle ?? 'monthly').toLowerCase();
      const days = cycle === 'yearly' ? 365 : 30;

      if (!targetId) {
        res.status(400).json({ error: 'ID de utilizador alvo não informado.' });
        return;
      }

      await ensureSubscription(targetId);
      await pool.query(
        `UPDATE subscriptions
         SET plan = $1,
             status = 'active',
             billing_cycle = $2,
             expires_at = NOW() + ($3 || ' days')::interval,
             updated_at = NOW()
         WHERE user_id = $4`,
        [plan, cycle, String(days), targetId]
      );

      res.json({
        ok: true,
        message: `Pagamento aprovado! Plano ${plan.toUpperCase()} ativo por ${days} dias.`,
      });
    })
  );

  // SaaS Admin: Announcements Management
  app.get(
    '/api/admin/announcements',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const resAnn = await pool.query(
        `SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50`
      );
      res.json({
        ok: true,
        announcements: resAnn.rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          message: String(r.message),
          severity: String(r.severity),
          isActive: Boolean(r.is_active),
          createdAt: new Date(String(r.created_at)).toISOString(),
        })),
      });
    })
  );

  app.post(
    '/api/admin/announcements',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const title = String(req.body?.title ?? '').trim();
      const message = String(req.body?.message ?? '').trim();
      const severity = String(req.body?.severity ?? 'info').trim();

      if (!title || !message) {
        res.status(400).json({ error: 'Título e mensagem do comunicado são obrigatórios.' });
        return;
      }

      const id = `ann_${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO announcements (id, title, message, severity, is_active, created_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())`,
        [id, title, message, severity]
      );

      res.json({ ok: true, message: 'Comunicado global publicado com sucesso para todos os clientes!' });
    })
  );

  app.delete(
    '/api/admin/announcements/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const id = String(req.params.id ?? '').trim();
      await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
      res.json({ ok: true, message: 'Comunicado removido.' });
    })
  );

  // Public / Client: Active platform announcements
  app.get(
    '/api/announcements',
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const resAnn = await pool.query(
        `SELECT id, title, message, severity, created_at
         FROM announcements
         WHERE is_active = TRUE
         ORDER BY created_at DESC
         LIMIT 5`
      );
      res.json({
        ok: true,
        announcements: resAnn.rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          message: String(r.message),
          severity: String(r.severity),
          createdAt: new Date(String(r.created_at)).toISOString(),
        })),
      });
    })
  );

  // Public: Active Subscription Plans for Landing Page & Pricing
  app.get(
    '/api/public/plans',
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const plansRes = await pool.query(
        `SELECT * FROM subscription_plans
         WHERE is_active = TRUE
         ORDER BY display_order ASC, price_monthly ASC`
      );
      const plans = plansRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        description: String(r.description ?? ''),
        priceMonthly: Number(r.price_monthly ?? 0),
        priceYearly: Number(r.price_yearly ?? 0),
        currency: String(r.currency ?? 'MZN'),
        features: Array.isArray(r.features)
          ? r.features
          : typeof r.features === 'string'
            ? JSON.parse(r.features)
            : [],
        isPopular: Boolean(r.is_popular),
        isActive: Boolean(r.is_active),
        displayOrder: Number(r.display_order ?? 0),
        createdAt: new Date(String(r.created_at)).toISOString(),
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
      res.json({ ok: true, plans });
    })
  );

  // SaaS Admin: List all subscription plans (active & inactive)
  app.get(
    '/api/admin/plans',
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const pool = getPool();
      const plansRes = await pool.query(
        `SELECT * FROM subscription_plans ORDER BY display_order ASC, created_at ASC`
      );
      const plans = plansRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        description: String(r.description ?? ''),
        priceMonthly: Number(r.price_monthly ?? 0),
        priceYearly: Number(r.price_yearly ?? 0),
        currency: String(r.currency ?? 'MZN'),
        features: Array.isArray(r.features)
          ? r.features
          : typeof r.features === 'string'
            ? JSON.parse(r.features)
            : [],
        isPopular: Boolean(r.is_popular),
        isActive: Boolean(r.is_active),
        displayOrder: Number(r.display_order ?? 0),
        createdAt: new Date(String(r.created_at)).toISOString(),
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
      res.json({ ok: true, plans });
    })
  );

  // SaaS Admin: Create a new subscription plan
  app.post(
    '/api/admin/plans',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const name = String(req.body?.name ?? '').trim();
      const slugRaw = String(req.body?.slug ?? name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const slug = slugRaw || `plan-${Date.now()}`;
      const description = String(req.body?.description ?? '').trim();
      const priceMonthly = Math.max(0, Number(req.body?.priceMonthly ?? 0));
      const priceYearly = Math.max(0, Number(req.body?.priceYearly ?? priceMonthly * 10));
      const currency = String(req.body?.currency ?? 'MZN').trim().toUpperCase();
      const features = Array.isArray(req.body?.features) ? req.body.features : [];
      const isPopular = Boolean(req.body?.isPopular);
      const isActive = req.body?.isActive !== false;
      const displayOrder = Number(req.body?.displayOrder ?? 99);

      if (!name) {
        res.status(400).json({ error: 'Nome do plano é obrigatório.' });
        return;
      }

      const id = `plan_${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO subscription_plans (
          id, name, slug, description, price_monthly, price_yearly, currency, features, is_popular, is_active, display_order, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, NOW(), NOW())`,
        [
          id,
          name,
          slug,
          description,
          priceMonthly,
          priceYearly,
          currency,
          JSON.stringify(features),
          isPopular,
          isActive,
          displayOrder,
        ]
      );

      res.status(201).json({ ok: true, message: `Plano "${name}" criado com sucesso!`, id });
    })
  );

  // SaaS Admin: Update an existing subscription plan
  app.put(
    '/api/admin/plans/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const planId = String(req.params.id ?? '').trim();
      const name = String(req.body?.name ?? '').trim();
      const description = String(req.body?.description ?? '').trim();
      const priceMonthly = Math.max(0, Number(req.body?.priceMonthly ?? 0));
      const priceYearly = Math.max(0, Number(req.body?.priceYearly ?? priceMonthly * 10));
      const currency = String(req.body?.currency ?? 'MZN').trim().toUpperCase();
      const features = Array.isArray(req.body?.features) ? req.body.features : [];
      const isPopular = Boolean(req.body?.isPopular);
      const isActive = Boolean(req.body?.isActive);
      const displayOrder = Number(req.body?.displayOrder ?? 0);

      if (!planId || !name) {
        res.status(400).json({ error: 'ID e Nome do plano são obrigatórios.' });
        return;
      }

      await pool.query(
        `UPDATE subscription_plans
         SET name = $1,
             description = $2,
             price_monthly = $3,
             price_yearly = $4,
             currency = $5,
             features = $6::jsonb,
             is_popular = $7,
             is_active = $8,
             display_order = $9,
             updated_at = NOW()
         WHERE id = $10`,
        [
          name,
          description,
          priceMonthly,
          priceYearly,
          currency,
          JSON.stringify(features),
          isPopular,
          isActive,
          displayOrder,
          planId,
        ]
      );

      res.json({ ok: true, message: `Plano "${name}" atualizado com sucesso!` });
    })
  );

  // SaaS Admin: Delete a subscription plan
  app.delete(
    '/api/admin/plans/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const pool = getPool();
      const planId = String(req.params.id ?? '').trim();

      if (!planId) {
        res.status(400).json({ error: 'ID do plano em falta.' });
        return;
      }

      // Proteger o plano base gratuito
      const checkRes = await pool.query('SELECT slug FROM subscription_plans WHERE id = $1', [planId]);
      if (checkRes.rows[0]?.slug === 'free') {
        res.status(400).json({ error: 'O plano Gratuito base não pode ser eliminado.' });
        return;
      }

      await pool.query('DELETE FROM subscription_plans WHERE id = $1', [planId]);
      res.json({ ok: true, message: 'Plano eliminado com sucesso.' });
    })
  );

  return app;
}

/**
 * Attaches the JSON error handler for Postgres and unexpected server errors.
 */
export function attachErrorHandler(app: express.Express): void {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23505') {
      res.status(409).json({ error: 'Registo duplicado. Verifique os dados informados.' });
      return;
    }
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });
}
