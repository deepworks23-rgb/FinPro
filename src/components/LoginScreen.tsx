import { useState, type FormEvent } from 'react';
import { isValidEmail } from '../utils/finance';

interface LoginScreenProps {
  initialEmail?: string;
  onAuthenticated: (email: string) => void;
  onBack: () => void;
}

export function LoginScreen({ initialEmail = '', onAuthenticated }: LoginScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const emailIsValid = isValidEmail(email);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!emailIsValid || password.length < 4) {
      setFeedbackMsg('Informe um e-mail válido e senha com ao menos 4 caracteres.');
      return;
    }

    setFeedbackMsg(null);
    setAuthStatus('loading');

    setTimeout(() => {
      setAuthStatus('success');
      setTimeout(() => {
        onAuthenticated(email.trim());
      }, 450);
    }, 650);
  };

  const handleBiometric = () => {
    if (authStatus !== 'idle') return;
    setAuthStatus('loading');
    setFeedbackMsg('Identidade biométrica confirmada!');
    setTimeout(() => {
      setAuthStatus('success');
      onAuthenticated(email.trim() || 'lucas.silva@fintrack.com');
    }, 550);
  };

  const handleSocial = (provider: 'Google' | 'Apple') => {
    if (authStatus !== 'idle') return;
    setAuthStatus('loading');
    setFeedbackMsg(`Iniciando sessão com ${provider}...`);
    setTimeout(() => {
      setAuthStatus('success');
      onAuthenticated(`lucas.${provider.toLowerCase()}@fintrack.com`);
    }, 550);
  };

  return (
    <div className="flex flex-col w-full px-margin pb-space-xl">
      <div className="relative w-full overflow-hidden flex flex-col items-center pt-space-md">
        {/* Brand / App Welcome Header */}
        <div className="flex flex-col items-center text-center w-full max-w-sm">
          <div className="relative flex items-center justify-center mb-space-sm">
            <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-lg shadow-primary-container/20">
              <span
                className="material-symbols-outlined text-[30px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                insights
              </span>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-surface-container-lowest animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-space-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
              FinTrack
            </span>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] uppercase font-bold tracking-wider">
              PRO
            </span>
          </div>

          <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
            {isRegisterMode ? 'Crie sua conta grátis' : 'Bem-vindo de volta'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xs leading-relaxed">
            {isRegisterMode
              ? 'Comece a organizar suas receitas, despesas e metas em tempo real.'
              : 'Acesse sua conta para gerenciar suas finanças pessoais em tempo real.'}
          </p>
        </div>

        {/* Login Form Card */}
        <div className="w-full max-w-sm mt-space-lg bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm">
          <form className="flex flex-col gap-space-md" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                className="font-label-sm text-label-sm text-on-surface-variant flex items-center justify-between"
                htmlFor="emailInput"
              >
                <span>E-mail</span>
                {emailIsValid && (
                  <span className="text-secondary font-label-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Válido
                  </span>
                )}
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  mail
                </span>
                <input
                  autoComplete="email"
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                  id="emailInput"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="font-label-sm text-label-sm text-on-surface-variant"
                  htmlFor="passwordInput"
                >
                  Senha
                </label>
                {!isRegisterMode && (
                  <button
                    className="font-label-sm text-label-sm text-primary font-semibold hover:underline active:opacity-75 transition-opacity cursor-pointer"
                    onClick={() =>
                      setFeedbackMsg('Link de redefinição enviado para seu e-mail cadastrado.')
                    }
                    type="button"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  lock
                </span>
                <input
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  className="w-full h-12 pl-11 pr-12 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                  id="passwordInput"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label="Alternar visibilidade da senha"
                  className="absolute right-2 w-9 h-9 flex items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  onClick={() => setShowPassword((prev) => !prev)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  checked={rememberMe}
                  className="sr-only peer"
                  onChange={(e) => setRememberMe(e.target.checked)}
                  type="checkbox"
                />
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    rememberMe ? 'bg-primary-container' : 'bg-surface-container'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-on-primary text-[16px] transition-opacity ${
                      rememberMe ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    check
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface font-medium group-hover:text-primary transition-colors">
                  Lembrar meu acesso
                </span>
              </label>
            </div>

            {/* Primary Action Button */}
            <button
              className={`w-full h-12 mt-1 rounded-xl text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 shadow-md shadow-primary-container/25 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer ${
                authStatus === 'success' ? 'bg-secondary' : 'bg-primary-container'
              }`}
              disabled={authStatus !== 'idle'}
              type="submit"
            >
              <span>
                {authStatus === 'loading'
                  ? 'Autenticando...'
                  : authStatus === 'success'
                    ? 'Conectado!'
                    : isRegisterMode
                      ? 'Criar Minha Conta'
                      : 'Entrar na Minha Conta'}
              </span>
              <span
                className={`material-symbols-outlined text-[20px] ${
                  authStatus === 'loading' ? 'animate-spin' : ''
                }`}
              >
                {authStatus === 'loading'
                  ? 'progress_activity'
                  : authStatus === 'success'
                    ? 'check'
                    : 'arrow_forward'}
              </span>
            </button>

            {/* Biometric Authentication Quick Option */}
            <button
              className="w-full h-12 rounded-xl bg-surface-container-high text-primary font-label-md text-label-md flex items-center justify-center gap-2.5 hover:bg-surface-container-highest active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
              disabled={authStatus !== 'idle'}
              onClick={handleBiometric}
              type="button"
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                fingerprint
              </span>
              <span>Entrar com Biometria</span>
            </button>
          </form>

          {feedbackMsg && (
            <div className="mt-space-sm p-space-sm rounded-xl bg-secondary-container text-on-secondary-container flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span className="font-label-sm text-label-sm font-semibold">{feedbackMsg}</span>
            </div>
          )}
        </div>

        {/* Social Authentication Divider */}
        <div className="w-full max-w-sm flex items-center gap-3 my-space-md px-space-xs">
          <div className="h-[1px] flex-1 bg-surface-container-highest" />
          <span className="font-label-sm text-label-sm text-outline font-medium tracking-wide">
            Ou continue com
          </span>
          <div className="h-[1px] flex-1 bg-surface-container-highest" />
        </div>

        {/* Social Authentication Buttons */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-space-sm">
          <button
            className="h-12 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md flex items-center justify-center gap-2.5 shadow-sm hover:bg-surface-container-low active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            disabled={authStatus !== 'idle'}
            onClick={() => handleSocial('Google')}
            type="button"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            className="h-12 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md flex items-center justify-center gap-2.5 shadow-sm hover:bg-surface-container-low active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            disabled={authStatus !== 'idle'}
            onClick={() => handleSocial('Apple')}
            type="button"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.65-.79 1.09-1.9 0.97-3-.94.04-2.07.63-2.73 1.41-.58.67-1.09 1.76-.95 2.83 1.05.08 2.13-.53 2.71-1.24z" />
            </svg>
            <span>Apple</span>
          </button>
        </div>

        {/* Registration Link Footer */}
        <div className="mt-space-md text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {isRegisterMode ? 'Já possui uma conta?' : 'Ainda não tem uma conta?'}
            <button
              className="font-label-md text-label-md text-primary font-bold ml-1 hover:underline active:opacity-75 transition-opacity cursor-pointer"
              onClick={() => {
                setIsRegisterMode((prev) => !prev);
                setFeedbackMsg(null);
              }}
              type="button"
            >
              {isRegisterMode ? 'Fazer login' : 'Cadastre-se grátis'}
            </button>
          </p>
        </div>

        {/* Bank-Grade Security Assurance Badge */}
        <div className="mt-space-md w-full max-w-sm rounded-xl bg-surface-container-high/60 p-space-sm flex items-center justify-center gap-2 text-on-surface-variant">
          <span
            className="material-symbols-outlined text-[18px] text-secondary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <span className="font-label-sm text-[11px] text-on-surface-variant font-medium tracking-tight">
            Criptografia de ponta a ponta de nível bancário
          </span>
        </div>
      </div>
    </div>
  );
}
