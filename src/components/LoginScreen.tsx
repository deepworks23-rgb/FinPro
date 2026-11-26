import { useState, type FormEvent } from 'react';
import { authApi, type AuthResponse } from '../services/api';
import { isValidEmail, isValidPhoneMZ } from '../utils/finance';

interface LoginScreenProps {
  initialIdentifier?: string;
  onAuthenticated: (auth: AuthResponse, mode: 'login' | 'register') => void;
}

export function LoginScreen({ initialIdentifier = '', onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login fields
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const [loadingMode, setLoadingMode] = useState<'idle' | 'submit'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !loginPassword) {
      setErrorMsg('Informe o número de telemóvel ou e-mail e a sua senha.');
      return;
    }

    setErrorMsg(null);
    setLoadingMode('submit');
    try {
      const auth = await authApi.login(identifier.trim(), loginPassword);
      onAuthenticated(auth, 'login');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao iniciar sessão.');
      setLoadingMode('idle');
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedAddress = address.trim();

    if (trimmedName.length < 2) {
      setErrorMsg('Informe o seu nome completo (mínimo 2 caracteres).');
      return;
    }
    if (!isValidPhoneMZ(trimmedPhone)) {
      setErrorMsg('Informe um número de telemóvel válido (mínimo 9 dígitos, ex: +258 84 123 4567).');
      return;
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setErrorMsg('O e-mail informado não tem um formato válido.');
      return;
    }
    if (trimmedAddress.length < 3) {
      setErrorMsg('Informe o seu endereço (ex: Bairro, Cidade).');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('A senha e a confirmação de senha não coincidem.');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg('É obrigatório concordar com os Termos de Uso e Política de Privacidade.');
      return;
    }

    setErrorMsg(null);
    setLoadingMode('submit');
    try {
      const auth = await authApi.register({
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        address: trimmedAddress,
        password,
        confirmPassword,
        acceptedTerms,
      });
      onAuthenticated(auth, 'register');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
      setLoadingMode('idle');
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setErrorMsg(null);
  };

  return (
    <div className="flex-1 flex flex-col w-full px-4 py-6">
      <div className="w-full max-w-[380px] m-auto flex flex-col items-center">
        {/* Header / Brand Mark */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/20 mb-3">
            <span
              className="material-symbols-outlined text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              account_balance_wallet
            </span>
          </div>
          <h1 className="text-[22px] leading-tight text-on-surface font-bold tracking-tight">
            {mode === 'login' ? 'Aceder à sua conta' : 'Criar Conta FinTrack'}
          </h1>
          <p className="text-[12.5px] text-on-surface-variant mt-1 max-w-xs leading-snug">
            {mode === 'login'
              ? 'Entre com o seu número de telemóvel ou e-mail e senha.'
              : 'Registe os seus dados para gerir finanças em Meticais (MT) ou USD.'}
          </p>
        </div>

        {/* Mode Segmented Control */}
        <div className="w-full grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-container-low mb-3">
          <button
            className={`h-10 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-surface-container-lowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => switchMode('login')}
            type="button"
          >
            Entrar
          </button>
          <button
            className={`h-10 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-surface-container-lowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => switchMode('register')}
            type="button"
          >
            Criar Conta
          </button>
        </div>

        {/* Form Card */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-3">
          {errorMsg && (
            <div
              className="p-2.5 rounded-xl bg-error-container text-on-error-container flex items-start gap-2 text-[12px] font-medium"
              role="alert"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span className="leading-snug break-words">{errorMsg}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form className="space-y-3" onSubmit={handleLoginSubmit}>
              <div className="space-y-1">
                <label
                  className="text-[12px] font-semibold text-on-surface-variant block"
                  htmlFor="loginIdentifier"
                >
                  Número de Telemóvel ou E-mail
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[19px] pointer-events-none">
                    person
                  </span>
                  <input
                    autoComplete="username"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    id="loginIdentifier"
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="+258 84 123 4567 ou e-mail"
                    required
                    type="text"
                    value={identifier}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  className="text-[12px] font-semibold text-on-surface-variant block"
                  htmlFor="loginPassword"
                >
                  Senha
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[19px] pointer-events-none">
                    lock
                  </span>
                  <input
                    autoComplete="current-password"
                    className="w-full h-11 pl-10 pr-11 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    id="loginPassword"
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Digite a sua senha"
                    required
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                  />
                  <button
                    aria-label="Mostrar ou ocultar senha"
                    className="absolute right-1.5 w-9 h-9 flex items-center justify-center rounded-lg text-outline hover:text-on-surface cursor-pointer"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {showLoginPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                className="w-full h-11 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                disabled={loadingMode !== 'idle'}
                type="submit"
              >
                <span>{loadingMode === 'submit' ? 'A entrar...' : 'Entrar na Conta'}</span>
                <span className="material-symbols-outlined text-[19px]">
                  {loadingMode === 'submit' ? 'progress_activity' : 'arrow_forward'}
                </span>
              </button>
            </form>
          ) : (
            <form className="space-y-2.5" onSubmit={handleRegisterSubmit}>
              <div className="space-y-1">
                <label
                  className="text-[12px] font-semibold text-on-surface-variant block"
                  htmlFor="regName"
                >
                  Nome Completo *
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[19px] pointer-events-none">
                    badge
                  </span>
                  <input
                    autoComplete="name"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    id="regName"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Edson Machava"
                    required
                    type="text"
                    value={name}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  className="text-[12px] font-semibold text-on-surface-variant block"
                  htmlFor="regPhone"
                >
                  Número de Telemóvel *
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[19px] pointer-events-none">
                    call
                  </span>
                  <input
                    autoComplete="tel"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    id="regPhone"
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+258 84 123 4567"
                    required
                    type="tel"
                    value={phone}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  className="text-[12px] font-semibold text-on-surface-variant flex items-center justify-between"
                  htmlFor="regEmail"
                >
                  <span>E-mail</span>
                  <span className="text-[11px] font-normal text-outline">Opcional</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[19px] pointer-events-none">
                    mail
                  </span>
                  <input
                    autoComplete="email"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    id="regEmail"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@fintrack.co.mz (opcional)"
                    type="email"
                    value={email}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  className="text-[12px] font-semibold text-on-surface-variant block"
                  htmlFor="regAddress"
                >
                  Endereço *
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[19px] pointer-events-none">
                    location_on
                  </span>
                  <input
                    autoComplete="street-address"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    id="regAddress"
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ex: Av. 24 de Julho, Polana, Maputo"
                    required
                    type="text"
                    value={address}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label
                    className="text-[12px] font-semibold text-on-surface-variant block"
                    htmlFor="regPassword"
                  >
                    Senha *
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                      lock
                    </span>
                    <input
                      autoComplete="new-password"
                      className="w-full h-11 pl-9 pr-10 rounded-xl bg-surface-container-low text-on-surface text-[13px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      id="regPassword"
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mín. 6 caracteres"
                      required
                      type={showRegPassword ? 'text' : 'password'}
                      value={password}
                    />
                    <button
                      aria-label="Mostrar senha"
                      className="absolute right-1 w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-on-surface cursor-pointer"
                      onClick={() => setShowRegPassword((v) => !v)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showRegPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-[12px] font-semibold text-on-surface-variant block"
                    htmlFor="regConfirmPassword"
                  >
                    Confirmar Senha *
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                      verified_user
                    </span>
                    <input
                      autoComplete="new-password"
                      className="w-full h-11 pl-9 pr-10 rounded-xl bg-surface-container-low text-on-surface text-[13px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      id="regConfirmPassword"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      required
                      type={showRegConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                    />
                    <button
                      aria-label="Mostrar confirmação de senha"
                      className="absolute right-1 w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-on-surface cursor-pointer"
                      onClick={() => setShowRegConfirm((v) => !v)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showRegConfirm ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[11px] font-semibold text-tertiary">
                  As senhas ainda não coincidem.
                </p>
              )}

              {/* Mandatory Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    checked={acceptedTerms}
                    className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
                    id="acceptTermsCheckbox"
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-[12px] text-on-surface leading-snug">
                    Concordo com os{' '}
                    <button
                      className="text-primary font-semibold hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        setTermsModalOpen(true);
                      }}
                      type="button"
                    >
                      Termos de Uso e Política de Privacidade
                    </button>{' '}
                    (obrigatório)
                  </span>
                </label>
              </div>

              <button
                className="w-full h-11 mt-1 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                disabled={loadingMode !== 'idle'}
                type="submit"
              >
                <span>{loadingMode === 'submit' ? 'A criar conta...' : 'Criar Minha Conta'}</span>
                <span className="material-symbols-outlined text-[19px]">
                  {loadingMode === 'submit' ? 'progress_activity' : 'person_add'}
                </span>
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant text-center">
          <span className="material-symbols-outlined text-[15px] text-secondary shrink-0">verified_user</span>
          <span>Autenticação protegida com encriptação de senha no servidor</span>
        </div>
      </div>

      {/* Terms Modal */}
      {termsModalOpen && (
        <div
          aria-labelledby="termsModalTitle"
          aria-modal="true"
          className="fixed inset-0 z-[75] bg-inverse-surface/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTermsModalOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container pb-2">
              <h2 className="text-[15px] font-bold text-on-surface" id="termsModalTitle">
                Termos de Uso & Privacidade
              </h2>
              <button
                aria-label="Fechar termos"
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
                onClick={() => setTermsModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="text-[12px] text-on-surface-variant space-y-2 max-h-60 overflow-y-auto leading-relaxed pr-1">
              <p>
                <strong>1. Uso da Plataforma:</strong> O FinTrack Moçambique é uma ferramenta de
                gestão financeira pessoal em Meticais (MT) e Dólares (USD) para registo voluntário de
                receitas, despesas, orçamentos e metas.
              </p>
              <p>
                <strong>2. Privacidade e Dados:</strong> Os seus dados de perfil (nome, telefone,
                e-mail opcional, endereço e foto) e movimentos financeiros são mantidos de forma
                privada e associados exclusivamente à sua conta autenticada.
              </p>
              <p>
                <strong>3. Segurança da Senha:</strong> A sua senha é protegida com hash criptográfico
                seguro no servidor e nunca é exibida em texto simples.
              </p>
              <p>
                <strong>4. Suporte:</strong> Em caso de dúvidas ou recuperação de acesso, utilize o
                canal oficial de suporte disponível na página de Perfil.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="flex-1 h-10 rounded-xl bg-surface-container text-on-surface text-[12.5px] font-semibold cursor-pointer"
                onClick={() => setTermsModalOpen(false)}
                type="button"
              >
                Fechar
              </button>
              <button
                className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-[12.5px] font-semibold cursor-pointer"
                onClick={() => {
                  setAcceptedTerms(true);
                  setTermsModalOpen(false);
                }}
                type="button"
              >
                Aceitar Termos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
