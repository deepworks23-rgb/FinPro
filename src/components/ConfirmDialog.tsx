import { AppIcon } from './AppIcon';
import { useEffect } from 'react';

export interface ConfirmDialogRequest {
  title: string;
  message: string;
  details?: string;
  variant?: 'danger' | 'primary' | 'warning';
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

interface ConfirmDialogProps {
  request: ConfirmDialogRequest | null;
  onClose: () => void;
}

const VARIANT_STYLES: Record<
  NonNullable<ConfirmDialogRequest['variant']>,
  { iconWrap: string; confirmBtn: string; defaultIcon: string }
> = {
  danger: {
    iconWrap: 'bg-error-container text-tertiary',
    confirmBtn: 'bg-tertiary-container text-on-tertiary shadow-md shadow-tertiary/20',
    defaultIcon: 'delete_forever',
  },
  warning: {
    iconWrap: 'bg-amber-100 text-amber-800',
    confirmBtn: 'bg-amber-600 text-white shadow-md shadow-amber-600/20',
    defaultIcon: 'warning',
  },
  primary: {
    iconWrap: 'bg-primary-fixed text-primary',
    confirmBtn: 'bg-primary text-on-primary shadow-md shadow-primary/20',
    defaultIcon: 'check_circle',
  },
};

export function ConfirmDialog({ request, onClose }: ConfirmDialogProps) {
  useEffect(() => {
    if (!request) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [request, onClose]);

  if (!request) return null;

  const variant = request.variant ?? 'primary';
  const style = VARIANT_STYLES[variant];
  const iconName = request.icon ?? style.defaultIcon;

  return (
    <div
      aria-labelledby="globalConfirmTitle"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-inverse-surface/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="bg-surface-container-lowest rounded-2xl p-4 max-w-xs w-full shadow-2xl flex flex-col items-center text-center gap-3">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${style.iconWrap}`}
        >
          <AppIcon name={iconName} className="text-[24px]" />
        </div>

        <div className="space-y-1 w-full">
          <h4 className="text-[16px] font-bold text-on-surface leading-snug" id="globalConfirmTitle">
            {request.title}
          </h4>
          <p className="text-[12.5px] text-on-surface-variant leading-snug break-words">
            {request.message}
          </p>
        </div>

        {request.details && (
          <div className="w-full rounded-xl bg-surface-container-low px-3 py-2 text-[12px] font-semibold text-on-surface break-words">
            {request.details}
          </div>
        )}

        <div className="flex gap-2 w-full pt-0.5">
          <button
            className="flex-1 h-10 rounded-xl bg-surface-container text-on-surface text-[13px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            {request.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            className={`flex-1 h-10 rounded-xl text-[13px] font-semibold active:scale-95 transition-all cursor-pointer ${style.confirmBtn}`}
            onClick={() => {
              const run = request.onConfirm;
              onClose();
              run();
            }}
            type="button"
          >
            {request.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
