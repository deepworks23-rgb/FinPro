import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'fintrack-db.json');

interface StoredUser {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  email: string;
  emailNormalized: string;
  address: string;
  avatarDataUrl: string;
  passwordHash: string;
  acceptedTermsAt: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredSession {
  userId: string;
  createdAt: number;
  expiresAt: number;
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

interface StoredWorkspace {
  transactions: unknown[];
  budgets: unknown[];
  goals: unknown[];
  currency: 'MZN' | 'USD';
  isBalanceHidden: boolean;
  alertSettings: {
    lowBalanceThreshold: number;
    negativeAlertThreshold: number;
    enableBudgetAlerts: boolean;
    enableGoalAlerts: boolean;
    enableLowBalanceAlerts: boolean;
    enablePendingAlerts: boolean;
  };
  readAlertSignatures: string[];
  updatedAt: string;
}

interface DatabaseShape {
  users: StoredUser[];
  sessions: Record<string, StoredSession>;
  workspaces: Record<string, StoredWorkspace>;
  supportTickets: StoredSupportTicket[];
}

interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
  authTokenId?: string;
}

function createEmptyWorkspace(): StoredWorkspace {
  return {
    transactions: [],
    budgets: [],
    goals: [],
    currency: 'MZN',
    isBalanceHidden: false,
    alertSettings: {
      lowBalanceThreshold: 5000,
      negativeAlertThreshold: 0,
      enableBudgetAlerts: true,
      enableGoalAlerts: true,
      enableLowBalanceAlerts: true,
      enablePendingAlerts: true,
    },
    readAlertSignatures: [],
    updatedAt: new Date().toISOString(),
  };
}

function loadDb(): DatabaseShape {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseShape = {
      users: [],
      sessions: {},
      workspaces: {},
      supportTickets: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseShape>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      workspaces:
        parsed.workspaces && typeof parsed.workspaces === 'object' ? parsed.workspaces : {},
      supportTickets: Array.isArray(parsed.supportTickets) ? parsed.supportTickets : [],
    };
  } catch {
    return { users: [], sessions: {}, workspaces: {}, supportTickets: [] };
  }
}

function saveDb(db: DatabaseShape): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_FILE);
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

function createSessionToken(db: DatabaseShape, userId: string): string {
  const now = Date.now();
  // Prune expired sessions opportunistically
  for (const [sid, session] of Object.entries(db.sessions)) {
    if (!session || session.expiresAt <= now) {
      delete db.sessions[sid];
    }
  }
  const tokenId = crypto.randomBytes(24).toString('hex');
  db.sessions[tokenId] = {
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  saveDb(db);
  return `${tokenId}.${signTokenId(tokenId)}`;
}

function verifySessionToken(
  db: DatabaseShape,
  token: string
): { tokenId: string; user: StoredUser } | null {
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

  const session = db.sessions[tokenId];
  if (!session || session.expiresAt <= Date.now()) {
    return null;
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { tokenId, user };
}

function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    address: user.address,
    avatarDataUrl: user.avatarDataUrl,
    isDemo: user.isDemo,
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
  };
}

function isValidAvatarDataUrl(val: string): boolean {
  if (val === '') return true;
  if (val.length > 350_000) return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(val);
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão não autenticada. Faça login para continuar.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const db = loadDb();
  const verified = verifySessionToken(db, token);
  if (!verified) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente.' });
    return;
  }
  req.authUser = verified.user;
  req.authTokenId = verified.tokenId;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Register a real user account
  app.post('/api/auth/register', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';
    const acceptedTerms = body?.acceptedTerms === true;

    if (name.length < 2 || name.length > 100) {
      res.status(400).json({ error: 'Informe o seu nome completo (mínimo 2 caracteres).' });
      return;
    }

    const phoneNormalized = normalizePhone(phone);
    if (phoneNormalized.length < 9 || phoneNormalized.length > 15) {
      res.status(400).json({
        error: 'Informe um número de telemóvel válido (mínimo 9 dígitos, ex: +258 84 123 4567).',
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

    const db = loadDb();
    const emailNormalized = email.toLowerCase();

    if (db.users.some((u) => u.phoneNormalized === phoneNormalized)) {
      res.status(409).json({ error: 'Este número de telemóvel já está cadastrado.' });
      return;
    }
    if (emailNormalized && db.users.some((u) => u.emailNormalized === emailNormalized)) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const userId = `usr_${crypto.randomUUID()}`;
    const newUser: StoredUser = {
      id: userId,
      name,
      phone,
      phoneNormalized,
      email,
      emailNormalized,
      address,
      avatarDataUrl: '',
      passwordHash: hashPassword(password),
      acceptedTermsAt: nowIso,
      isDemo: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const workspace = createEmptyWorkspace();
    db.users.push(newUser);
    db.workspaces[userId] = workspace;
    const token = createSessionToken(db, userId);

    res.status(201).json({
      token,
      user: sanitizeUser(newUser),
      workspace,
    });
  });

  // Real login via phone number OR email + password
  app.post('/api/auth/login', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!identifier || !password) {
      res.status(400).json({ error: 'Informe o número/e-mail e a sua senha.' });
      return;
    }

    const db = loadDb();
    const lower = identifier.toLowerCase();
    const normPhone = normalizePhone(identifier);

    const user = db.users.find((u) => {
      if (u.emailNormalized && u.emailNormalized === lower) return true;
      if (normPhone.length >= 9 && u.phoneNormalized === normPhone) return true;
      return false;
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Número/e-mail ou senha incorretos.' });
      return;
    }

    if (!db.workspaces[user.id]) {
      db.workspaces[user.id] = createEmptyWorkspace();
    }

    const token = createSessionToken(db, user.id);
    res.json({
      token,
      user: sanitizeUser(user),
      workspace: db.workspaces[user.id],
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authTokenId) {
      const db = loadDb();
      delete db.sessions[req.authTokenId];
      saveDb(db);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const db = loadDb();
    const workspace = db.workspaces[user.id] ?? createEmptyWorkspace();
    res.json({
      user: sanitizeUser(user),
      workspace,
    });
  });

  // Update profile data & avatar upload
  app.patch('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const body = req.body as Record<string, unknown>;
    const db = loadDb();
    const target = db.users.find((u) => u.id === user.id);
    if (!target) {
      res.status(404).json({ error: 'Utilizador não encontrado.' });
      return;
    }

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
      if (db.users.some((u) => u.id !== target.id && u.phoneNormalized === norm)) {
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
      if (normEmail && db.users.some((u) => u.id !== target.id && u.emailNormalized === normEmail)) {
        res.status(409).json({ error: 'Este e-mail já está em uso por outra conta.' });
        return;
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
      if (!isValidAvatarDataUrl(body.avatarDataUrl)) {
        res.status(400).json({
          error: 'Foto inválida. Use uma imagem PNG, JPG ou WebP com tamanho reduzido.',
        });
        return;
      }
      target.avatarDataUrl = body.avatarDataUrl;
    }

    if (body.currency === 'MZN' || body.currency === 'USD') {
      if (!db.workspaces[target.id]) {
        db.workspaces[target.id] = createEmptyWorkspace();
      }
      db.workspaces[target.id].currency = body.currency;
      db.workspaces[target.id].updatedAt = new Date().toISOString();
    }

    target.updatedAt = new Date().toISOString();
    saveDb(db);

    res.json({
      user: sanitizeUser(target),
      workspace: db.workspaces[target.id],
    });
  });

  // Change password (verifies current password for password-protected accounts)
  app.post('/api/profile/password', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const body = req.body as Record<string, unknown>;
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'A nova senha e a confirmação não coincidem.' });
      return;
    }

    const db = loadDb();
    const target = db.users.find((u) => u.id === user.id);
    if (!target) {
      res.status(404).json({ error: 'Utilizador não encontrado.' });
      return;
    }

    if (target.passwordHash) {
      if (!currentPassword || !verifyPassword(currentPassword, target.passwordHash)) {
        res.status(401).json({ error: 'A senha atual está incorreta.' });
        return;
      }
    }

    target.passwordHash = hashPassword(newPassword);
    target.updatedAt = new Date().toISOString();
    saveDb(db);

    res.json({ ok: true, user: sanitizeUser(target) });
  });

  // Save authenticated user's financial workspace
  app.put('/api/workspace', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const body = req.body as Record<string, unknown>;
    const db = loadDb();

    const existing = db.workspaces[user.id] ?? createEmptyWorkspace();

    const nextWorkspace: StoredWorkspace = {
      transactions: Array.isArray(body.transactions) ? body.transactions : existing.transactions,
      budgets: Array.isArray(body.budgets) ? body.budgets : existing.budgets,
      goals: Array.isArray(body.goals) ? body.goals : existing.goals,
      currency: body.currency === 'MZN' || body.currency === 'USD' ? body.currency : existing.currency,
      isBalanceHidden:
        typeof body.isBalanceHidden === 'boolean'
          ? body.isBalanceHidden
          : existing.isBalanceHidden,
      alertSettings:
        body.alertSettings && typeof body.alertSettings === 'object'
          ? {
              ...existing.alertSettings,
              ...(body.alertSettings as Partial<StoredWorkspace['alertSettings']>),
            }
          : existing.alertSettings,
      readAlertSignatures: Array.isArray(body.readAlertSignatures)
        ? body.readAlertSignatures.filter((x): x is string => typeof x === 'string')
        : existing.readAlertSignatures,
      updatedAt: new Date().toISOString(),
    };

    db.workspaces[user.id] = nextWorkspace;
    saveDb(db);
    res.json({ workspace: nextWorkspace });
  });

  // Submit a real support ticket
  app.post('/api/support', requireAuth, (req: AuthenticatedRequest, res) => {
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

    const db = loadDb();
    const code = `FT-${new Date().getFullYear()}-${String(1000 + db.supportTickets.length + 1)}`;
    const ticket: StoredSupportTicket = {
      id: `sup_${crypto.randomUUID()}`,
      code,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      userEmail: user.email,
      subject,
      category: category.slice(0, 60),
      contactChannel: contactChannel.slice(0, 40),
      message,
      status: 'aberto',
      createdAt: new Date().toISOString(),
    };

    db.supportTickets.unshift(ticket);
    saveDb(db);
    res.status(201).json({ ticket });
  });

  // List support tickets for the authenticated user
  app.get('/api/support', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const db = loadDb();
    const tickets = db.supportTickets.filter((t) => t.userId === user.id);
    res.json({ tickets });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinTrack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
