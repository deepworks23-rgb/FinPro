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
