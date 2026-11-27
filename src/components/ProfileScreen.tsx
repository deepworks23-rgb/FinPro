import { AppIcon } from './AppIcon';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { authApi } from '../services/api';
import type {
  CurrencyCode,
  SupportTicket,
  UserProfile,
  UserSubscription,
} from '../types/finance';
import { getUserInitials, isValidEmail, isValidPhoneMZ } from '../utils/finance';
import type { ConfirmDialogRequest } from './ConfirmDialog';

interface ProfileScreenProps {
  user: UserProfile;
  authToken: string;
  currency: CurrencyCode;
  onChangeCurrency: (next: CurrencyCode) => void;
  onUpdateProfile: (updates: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    avatarDataUrl?: string;
    currency?: CurrencyCode;
  }) => Promise<void>;
  onChangePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
  onRequestConfirm: (req: ConfirmDialogRequest) => void;
  onNotify: (msg: string) => void;
  subscription?: UserSubscription | null;
  onOpenPricing?: () => void;
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro selecionado.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('O ficheiro selecionado não é uma imagem válida.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Erro ao processar a imagem.'));
          return;
        }
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileScreen({
  user,
  authToken,
  currency,
  subscription,
  onOpenPricing,
  onChangeCurrency,
  onUpdateProfile,
  onChangePassword,
  onLogout,
  onRequestConfirm,
  onNotify,
}: ProfileScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [address, setAddress] = useState(user.address);
  const [avatarPreview, setAvatarPreview] = useState(user.avatarDataUrl);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Support modal
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportCategory, setSupportCategory] = useState('Conta e Acesso');
  const [supportChannel, setSupportChannel] = useState('WhatsApp');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportError, setSupportError] = useState<string | null>(null);
  const [sendingSupport, setSendingSupport] = useState(false);
  const [recentTickets, setRecentTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone);
    setEmail(user.email);
    setAddress(user.address);
    setAvatarPreview(user.avatarDataUrl);
    setAvatarLoadError(false);
  }, [user]);

  useEffect(() => {
    if (!supportOpen) return;
    authApi
      .listSupportTickets(authToken)
      .then((res) => setRecentTickets(res.tickets))
      .catch(() => {});
  }, [supportOpen, authToken]);

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      onNotify('Escolha uma foto PNG, JPG ou WebP.');
      return;
    }

    try {
      const dataUrl = await compressImageToDataUrl(file);
      setAvatarLoadError(false);
      setAvatarPreview(dataUrl);
      onRequestConfirm({
        variant: 'primary',
        icon: 'photo_camera',
        title: 'Atualizar Foto de Perfil?',
        message: 'Deseja guardar a nova foto no seu perfil?',
        confirmLabel: 'Sim, Guardar',
        cancelLabel: 'Cancelar',
        onConfirm: async () => {
          try {
            await onUpdateProfile({ avatarDataUrl: dataUrl });
            onNotify('Foto de perfil atualizada!');
          } catch (err) {
            setAvatarPreview(user.avatarDataUrl);
            onNotify(err instanceof Error ? err.message : 'Erro ao guardar foto.');
          }
        },
      });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    }
  };

  const handleRemovePhoto = () => {
    onRequestConfirm({
      variant: 'warning',
      icon: 'no_photography',
      title: 'Remover Foto de Perfil?',
      message: 'A foto atual será removida e substituída pelas suas iniciais.',
      confirmLabel: 'Sim, Remover',
      cancelLabel: 'Voltar',
      onConfirm: async () => {
        try {
          await onUpdateProfile({ avatarDataUrl: '' });
          setAvatarPreview('');
          onNotify('Foto de perfil removida.');
        } catch (err) {
          onNotify(err instanceof Error ? err.message : 'Erro ao remover foto.');
        }
      },
    });
  };

  const handleSaveProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedAddress = address.trim();

    if (trimmedName.length < 2) {
      setProfileError('Informe o seu nome completo (mínimo 2 caracteres).');
      return;
    }
    if (!isValidPhoneMZ(trimmedPhone)) {
      setProfileError('Informe um número de telemóvel válido (mínimo 9 dígitos).');
      return;
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setProfileError('O e-mail informado não é válido.');
      return;
    }
    if (trimmedAddress.length < 3) {
      setProfileError('Informe o seu endereço (mínimo 3 caracteres).');
      return;
    }

    setProfileError(null);
    onRequestConfirm({
      variant: 'primary',
      icon: 'person',
      title: 'Guardar Dados do Perfil?',
      message: 'Deseja atualizar as suas informações pessoais e preferências?',
      details: `${trimmedName} · ${trimmedPhone}`,
      confirmLabel: 'Sim, Guardar',
      cancelLabel: 'Voltar',
      onConfirm: async () => {
        setSavingProfile(true);
        try {
          await onUpdateProfile({
            name: trimmedName,
            phone: trimmedPhone,
            email: trimmedEmail,
            address: trimmedAddress,
            currency,
          });
          onNotify('Dados do perfil atualizados!');
        } catch (err) {
          setProfileError(err instanceof Error ? err.message : 'Erro ao atualizar perfil.');
        } finally {
          setSavingProfile(false);
        }
      },
    });
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (user.hasPassword && !currentPassword) {
      setPasswordError('Informe a sua senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A nova senha e a confirmação não coincidem.');
      return;
    }

    setPasswordError(null);
    onRequestConfirm({
      variant: 'warning',
      icon: 'lock_reset',
      title: 'Alterar Senha de Acesso?',
      message: 'Passará a utilizar a nova senha nos próximos inícios de sessão.',
      confirmLabel: 'Sim, Alterar',
      cancelLabel: 'Voltar',
      onConfirm: async () => {
        setSavingPassword(true);
        try {
          await onChangePassword({
            currentPassword,
            newPassword,
            confirmPassword,
          });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          onNotify('Senha alterada com sucesso!');
        } catch (err) {
          setPasswordError(err instanceof Error ? err.message : 'Erro ao alterar senha.');
        } finally {
          setSavingPassword(false);
        }
      },
    });
  };

  const handleSupportSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (supportSubject.trim().length < 3) {
      setSupportError('Informe um assunto com pelo menos 3 caracteres.');
      return;
    }
    if (supportMessage.trim().length < 8) {
      setSupportError('Escreva a sua mensagem com pelo menos 8 caracteres.');
      return;
    }

    setSupportError(null);
    onRequestConfirm({
      variant: 'primary',
      icon: 'support_agent',
      title: 'Enviar Pedido ao Suporte?',
      message: 'A nossa equipa de Moçambique receberá a sua solicitação.',
      details: `${supportCategory} · Via ${supportChannel}`,
      confirmLabel: 'Sim, Enviar',
      cancelLabel: 'Voltar',
      onConfirm: async () => {
        setSendingSupport(true);
        try {
          const res = await authApi.submitSupportTicket(authToken, {
            subject: supportSubject.trim(),
            category: supportCategory,
            contactChannel: supportChannel,
            message: supportMessage.trim(),
          });
          setRecentTickets((prev) => [res.ticket, ...prev]);
          setSupportSubject('');
          setSupportMessage('');
          onNotify(`Pedido enviado! Protocolo ${res.ticket.code}`);
        } catch (err) {
          setSupportError(err instanceof Error ? err.message : 'Erro ao enviar pedido.');
        } finally {
          setSendingSupport(false);
        }
      },
    });
  };

  const initials = getUserInitials(user.name);
  const showPhoto = Boolean(avatarPreview) && !avatarLoadError;

  return (
    <div className="flex flex-col w-full space-y-4 pb-4">
      {/* Top Profile Identity & Photo Upload Card */}
      <section className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-primary/20 bg-primary-fixed text-primary flex items-center justify-center font-bold text-[20px]">
              {showPhoto ? (
                <img
                  alt={user.name}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarLoadError(true)}
                  referrerPolicy="no-referrer"
                  src={avatarPreview}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <button
              aria-label="Carregar foto de perfil"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:bg-primary-container cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <AppIcon name="photo_camera" className="text-[15px]" />
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <h2 className="text-[16px] font-bold text-on-surface leading-snug break-words">
              {user.name}
            </h2>
            <p className="text-[12px] text-on-surface-variant break-words">
              {user.phone}
              {user.email ? ` · ${user.email}` : ''}
            </p>
            <p className="text-[11px] text-primary font-semibold">
              Conta Pessoal Verificada
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp"
          aria-label="Selecionar ficheiro de foto de perfil"
          className="hidden"
          id="profilePhotoInput"
          onChange={handlePhotoSelected}
          type="file"
        />

        <div className="flex items-center gap-2 pt-0.5">
          <button
            className="flex-1 h-10 rounded-xl bg-primary-fixed text-primary text-[12.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-fixed-dim/50 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <AppIcon name="upload" className="text-[18px]" />
            <span>Carregar Foto</span>
          </button>
          {showPhoto && (
            <button
              className="h-10 px-3 rounded-xl bg-surface-container text-on-surface-variant text-[12.5px] font-semibold flex items-center justify-center gap-1 hover:bg-error-container hover:text-tertiary transition-colors cursor-pointer whitespace-nowrap"
              onClick={handleRemovePhoto}
              type="button"
            >
              <AppIcon name="delete" className="text-[17px]" />
              <span>Remover</span>
            </button>
          )}
        </div>
      </section>

      {/* SaaS Subscription Card */}
      <section className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-primary/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <AppIcon name="workspace_premium" className="text-[26px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14.5px] font-bold text-on-surface">
                Plano {subscription?.plan === 'business' ? 'FinPro Negócios 💼' : subscription?.plan === 'pro' ? 'FinPro Pessoal ⭐' : 'Gratuito'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  subscription?.plan === 'business'
                    ? 'bg-amber-100 text-amber-900'
                    : subscription?.plan === 'pro'
                      ? 'bg-primary-fixed text-primary'
                      : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {subscription?.status === 'active' ? 'Ativo' : 'Básico'}
              </span>
            </div>
            <p className="text-[11.5px] text-on-surface-variant mt-0.5">
              {subscription?.plan === 'free'
                ? 'Limite de 25 transações/mês. Faça upgrade para lançamentos ilimitados e relatórios avançados.'
                : `Cobrança ${subscription?.billingCycle === 'yearly' ? 'Anual (-20% OFF)' : 'Mensal'} via ${subscription?.paymentMethod?.toUpperCase() ?? 'M-Pesa'}.`}
            </p>
          </div>
        </div>

        <button
          className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[12.5px] font-semibold transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap self-stretch sm:self-auto flex items-center justify-center gap-1.5"
          onClick={onOpenPricing}
          type="button"
        >
          <AppIcon name="stars" className="text-[17px]" />
          <span>{subscription?.plan === 'free' ? 'Fazer Upgrade PRO' : 'Gerir Plano'}</span>
        </button>
      </section>

      {/* Linha Responsiva: Dados do Perfil & Segurança */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dados Pessoais & Configurações */}
        <section className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-surface-container pb-2">
          <AppIcon name="manage_accounts" className="text-primary text-[20px]" />
          <h3 className="text-[14.5px] font-bold text-on-surface">Dados do Perfil</h3>
        </div>

        {profileError && (
          <div
            className="p-2.5 rounded-xl bg-error-container text-on-error-container text-[12px] font-medium flex items-center gap-2"
            role="alert"
          >
            <AppIcon name="error" className="text-[17px] shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form className="space-y-2.5" onSubmit={handleSaveProfileSubmit}>
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-on-surface-variant block" htmlFor="pfName">
              Nome Completo *
            </label>
            <input
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
              id="pfName"
              onChange={(e) => setName(e.target.value)}
              required
              type="text"
              value={name}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-on-surface-variant block" htmlFor="pfPhone">
              Número de Telemóvel *
            </label>
            <input
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
              id="pfPhone"
              onChange={(e) => setPhone(e.target.value)}
              required
              type="tel"
              value={phone}
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-[12px] font-semibold text-on-surface-variant flex items-center justify-between"
              htmlFor="pfEmail"
            >
              <span>E-mail</span>
              <span className="text-[11px] font-normal text-outline">Opcional</span>
            </label>
            <input
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
              id="pfEmail"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Opcional"
              type="email"
              value={email}
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-[12px] font-semibold text-on-surface-variant block"
              htmlFor="pfAddress"
            >
              Endereço *
            </label>
            <input
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
              id="pfAddress"
              onChange={(e) => setAddress(e.target.value)}
              required
              type="text"
              value={address}
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-[12px] font-semibold text-on-surface-variant block"
              htmlFor="pfCurrency"
            >
              Moeda Padrão
            </label>
            <select
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              id="pfCurrency"
              onChange={(e) => onChangeCurrency(e.target.value as CurrencyCode)}
              value={currency}
            >
              <option value="MZN">MZN — Metical Moçambicano</option>
              <option value="USD">USD — Dólar Americano</option>
            </select>
          </div>

          <button
            className="w-full h-11 rounded-xl bg-primary text-on-primary text-[13.5px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            disabled={savingProfile}
            type="submit"
          >
            <AppIcon name="save" className="text-[19px]" />
            <span>{savingProfile ? 'A guardar...' : 'Guardar Dados do Perfil'}</span>
          </button>
        </form>
      </section>

      {/* Segurança & Alteração de Senha */}
      <section className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-surface-container pb-2">
          <AppIcon name="lock" className="text-primary text-[20px]" />
          <h3 className="text-[14.5px] font-bold text-on-surface">Segurança e Senha</h3>
        </div>

        {passwordError && (
          <div
            className="p-2.5 rounded-xl bg-error-container text-on-error-container text-[12px] font-medium flex items-center gap-2"
            role="alert"
          >
            <AppIcon name="error" className="text-[17px] shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form className="space-y-2.5" onSubmit={handlePasswordSubmit}>
          {user.hasPassword && (
            <div className="space-y-1">
              <label
                className="text-[12px] font-semibold text-on-surface-variant block"
                htmlFor="pfCurrentPassword"
              >
                Senha Atual
              </label>
              <div className="relative flex items-center">
                <input
                  autoComplete="current-password"
                  className="w-full h-10 pl-3 pr-10 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
                  id="pfCurrentPassword"
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite a senha atual"
                  type={showCurrentPwd ? 'text' : 'password'}
                  value={currentPassword}
                />
                <button
                  aria-label="Mostrar senha atual"
                  className="absolute right-1.5 w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-on-surface cursor-pointer"
                  onClick={() => setShowCurrentPwd((v) => !v)}
                  type="button"
                >
                  <AppIcon name={showCurrentPwd ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label
                className="text-[12px] font-semibold text-on-surface-variant block"
                htmlFor="pfNewPassword"
              >
                Nova Senha
              </label>
              <div className="relative flex items-center">
                <input
                  autoComplete="new-password"
                  className="w-full h-10 pl-3 pr-10 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
                  id="pfNewPassword"
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPassword}
                />
                <button
                  aria-label="Mostrar nova senha"
                  className="absolute right-1.5 w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-on-surface cursor-pointer"
                  onClick={() => setShowNewPwd((v) => !v)}
                  type="button"
                >
                  <AppIcon name={showNewPwd ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label
                className="text-[12px] font-semibold text-on-surface-variant block"
                htmlFor="pfConfirmNewPassword"
              >
                Confirmar Nova Senha
              </label>
              <input
                autoComplete="new-password"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="pfConfirmNewPassword"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                type={showNewPwd ? 'text' : 'password'}
                value={confirmPassword}
              />
            </div>
          </div>

          <button
            className="w-full h-10 rounded-xl bg-surface-container-high text-primary text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-primary-fixed active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            disabled={savingPassword}
            type="submit"
          >
            <AppIcon name="key" className="text-[18px]" />
            <span>{savingPassword ? 'A alterar...' : 'Alterar Senha'}</span>
          </button>
        </form>
      </section>
    </div>

    {/* Linha Responsiva: Suporte & Sessão */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Suporte ao Cliente */}
      <section className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm space-y-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-secondary-container/70 text-secondary flex items-center justify-center shrink-0">
              <AppIcon name="support_agent" className="text-[21px]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14.5px] font-bold text-on-surface leading-tight">
                Suporte FinTrack
              </h3>
              <p className="text-[11.5px] text-on-surface-variant leading-snug">
                Precisa de ajuda com a sua conta ou registos?
              </p>
            </div>
          </div>
        </div>

        <button
          className="w-full h-11 rounded-xl bg-secondary text-on-secondary text-[13.5px] font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          onClick={() => setSupportOpen(true)}
          type="button"
        >
          <AppIcon name="headset_mic" className="text-[19px]" />
          <span>Contactar Suporte</span>
        </button>
      </section>

      {/* Sessão & Manutenção */}
      <section className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm space-y-2 flex flex-col justify-between">
        <div>
          <h3 className="text-[14.5px] font-bold text-on-surface leading-tight mb-1">
            Gestão de Sessão
          </h3>
          <p className="text-[11.5px] text-on-surface-variant">
            Termine a sessão atual com segurança no seu navegador.
          </p>
        </div>
        <button
          className="w-full h-11 rounded-xl bg-error-container/70 text-tertiary text-[13.5px] font-semibold flex items-center justify-center gap-2 hover:bg-error-container transition-colors cursor-pointer"
          onClick={() =>
            onRequestConfirm({
              variant: 'danger',
              icon: 'logout',
              title: 'Terminar Sessão?',
              message: 'Deseja sair da sua conta FinTrack neste dispositivo?',
              details: `${user.name} · ${user.phone}`,
              confirmLabel: 'Sim, Sair',
              cancelLabel: 'Voltar',
              onConfirm: () => {
                void onLogout();
              },
            })
          }
          type="button"
        >
          <AppIcon name="logout" className="text-[19px]" />
          <span>Terminar Sessão (Sair)</span>
        </button>
      </section>
    </div>

    {/* Support Modal */}
      {supportOpen && (
        <div
          aria-labelledby="supportModalTitle"
          aria-modal="true"
          className="fixed inset-0 z-[65] bg-inverse-surface/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSupportOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-surface-container pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <AppIcon name="support_agent" className="text-[20px]" />
                </div>
                <div>
                  <h3 className="text-[15.5px] font-bold text-on-surface" id="supportModalTitle">
                    Atendimento ao Cliente
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Maputo · Seg–Sex, 08:00–17:00 CAT
                  </p>
                </div>
              </div>
              <button
                aria-label="Fechar suporte"
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
                onClick={() => setSupportOpen(false)}
                type="button"
              >
                <AppIcon name="close" className="text-[19px]" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-0.5 flex-1">
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div className="p-2.5 rounded-xl bg-surface-container-low">
                  <span className="text-on-surface-variant block">WhatsApp Suporte</span>
                  <strong className="text-on-surface tabular-nums">+258 84 000 1234</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-low">
                  <span className="text-on-surface-variant block">E-mail Oficial</span>
                  <strong className="text-on-surface break-all">suporte@fintrack.co.mz</strong>
                </div>
              </div>

              {supportError && (
                <div
                  className="p-2.5 rounded-xl bg-error-container text-on-error-container text-[12px] font-medium"
                  role="alert"
                >
                  {supportError}
                </div>
              )}

              <form className="space-y-2.5" onSubmit={handleSupportSubmit}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label
                      className="text-[11.5px] font-semibold text-on-surface-variant block"
                      htmlFor="supCat"
                    >
                      Categoria
                    </label>
                    <select
                      className="w-full h-9 px-2.5 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] cursor-pointer"
                      id="supCat"
                      onChange={(e) => setSupportCategory(e.target.value)}
                      value={supportCategory}
                    >
                      <option value="Conta e Acesso">Conta e Acesso</option>
                      <option value="Transações & M-Pesa">Transações & M-Pesa</option>
                      <option value="Relatórios PDF/CSV">Relatórios PDF/CSV</option>
                      <option value="Sugestão ou Erro">Sugestão ou Erro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-[11.5px] font-semibold text-on-surface-variant block"
                      htmlFor="supChannel"
                    >
                      Responder via
                    </label>
                    <select
                      className="w-full h-9 px-2.5 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] cursor-pointer"
                      id="supChannel"
                      onChange={(e) => setSupportChannel(e.target.value)}
                      value={supportChannel}
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Chamada Telefónica">Chamada</option>
                      <option value="E-mail">E-mail</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-[11.5px] font-semibold text-on-surface-variant block"
                    htmlFor="supSubject"
                  >
                    Assunto
                  </label>
                  <input
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                    id="supSubject"
                    onChange={(e) => setSupportSubject(e.target.value)}
                    placeholder="Ex: Dúvida sobre sincronização de saldo"
                    required
                    type="text"
                    value={supportSubject}
                  />
                </div>

                <div className="space-y-1">
                  <label
                    className="text-[11.5px] font-semibold text-on-surface-variant block"
                    htmlFor="supMessage"
                  >
                    Mensagem
                  </label>
                  <textarea
                    className="w-full min-h-[84px] p-3 rounded-xl bg-surface-container-low text-on-surface text-[13px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    id="supMessage"
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Descreva como podemos ajudar..."
                    required
                    value={supportMessage}
                  />
                </div>

                <button
                  className="w-full h-10 rounded-xl bg-primary text-on-primary text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  disabled={sendingSupport}
                  type="submit"
                >
                  <AppIcon name="send" className="text-[18px]" />
                  <span>{sendingSupport ? 'A enviar...' : 'Enviar Pedido de Suporte'}</span>
                </button>
              </form>

              {recentTickets.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-surface-container">
                  <span className="text-[11.5px] font-bold text-on-surface block">
                    Pedidos Recentes
                  </span>
                  {recentTickets.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded-xl bg-surface-container-low flex items-center justify-between gap-2 text-[11.5px]"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-primary block">{t.code}</span>
                        <span className="text-on-surface break-words">{t.subject}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold text-[10.5px] shrink-0">
                        Aberto
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
