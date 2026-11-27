import { AppIcon } from './AppIcon';
import type { AdminAnnouncement } from '../types/finance';

interface AnnouncementBannerProps {
  announcements: AdminAnnouncement[];
  dismissedIds: string[];
  onDismiss: (id: string) => void;
  onOpenPricing?: () => void;
  onOpenSupport?: () => void;
}

const SEVERITY_CONFIG: Record<
  AdminAnnouncement['severity'],
  {
    containerBg: string;
    border: string;
    textColor: string;
    badgeBg: string;
    badgeText: string;
    badgeLabel: string;
    icon: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  info: {
    containerBg: 'bg-blue-50/90 dark:bg-blue-950/40',
    border: 'border-blue-200/90 dark:border-blue-800/60',
    textColor: 'text-blue-950 dark:text-blue-100',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
    badgeText: 'text-blue-700',
    badgeLabel: 'COMUNICADO',
    icon: 'campaign',
    iconBg: 'bg-blue-100 dark:bg-blue-900/80',
    iconColor: 'text-blue-700 dark:text-blue-300',
  },
  warning: {
    containerBg: 'bg-amber-50/95 dark:bg-amber-950/40',
    border: 'border-amber-300/80 dark:border-amber-800/60',
    textColor: 'text-amber-950 dark:text-amber-100',
    badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200',
    badgeText: 'text-amber-800',
    badgeLabel: 'AVISO IMPORTANTE',
    icon: 'warning',
    iconBg: 'bg-amber-100 dark:bg-amber-900/80',
    iconColor: 'text-amber-800 dark:text-amber-300',
  },
  critical: {
    containerBg: 'bg-rose-50/95 dark:bg-rose-950/45',
    border: 'border-rose-300/80 dark:border-rose-800/60',
    textColor: 'text-rose-950 dark:text-rose-100',
    badgeBg: 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200',
    badgeText: 'text-rose-800',
    badgeLabel: 'URGENTE',
    icon: 'crisis_alert',
    iconBg: 'bg-rose-100 dark:bg-rose-900/80',
    iconColor: 'text-rose-700 dark:text-rose-300',
  },
};

function formatAnnouncementTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return 'Hoje';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 2) return 'Agora mesmo';
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Há ${diffHours}h`;
    return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
  } catch {
    return 'Recente';
  }
}

export function AnnouncementBanner({
  announcements,
  dismissedIds,
  onDismiss,
  onOpenPricing,
  onOpenSupport,
}: AnnouncementBannerProps) {
  // Only display active announcements that have not been dismissed by the user
  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.includes(a.id));

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-2 mb-4 shrink-0 transition-all duration-300">
      {visibleAnnouncements.map((item) => {
        const config = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.info;
        const timeLabel = formatAnnouncementTime(item.createdAt);

        return (
          <div
            key={item.id}
            className={`w-full rounded-[10px] border p-3.5 sm:p-4 shadow-xs relative overflow-hidden backdrop-blur-xs transition-all ${config.containerBg} ${config.border} ${config.textColor}`}
          >
            {/* Top Indicator bar */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-[10px] ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0 mt-0.5 shadow-xs`}
                >
                  <AppIcon name={config.icon} className="text-[20px]" />
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-[6px] text-[10px] font-black tracking-wider uppercase ${config.badgeBg}`}
                    >
                      {config.badgeLabel}
                    </span>
                    <span className="text-[11px] opacity-75 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      {timeLabel}
                    </span>
                  </div>

                  <h4 className="text-[14px] sm:text-[15px] font-bold tracking-tight leading-snug">
                    {item.title}
                  </h4>

                  <p className="text-[12.5px] sm:text-[13px] opacity-90 leading-relaxed break-words whitespace-pre-line">
                    {item.message}
                  </p>

                  {/* Contextual Action Buttons */}
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    {item.message.toLowerCase().includes('plano') ||
                    item.title.toLowerCase().includes('plano') ||
                    item.message.toLowerCase().includes('subscri') ? (
                      onOpenPricing && (
                        <button
                          type="button"
                          onClick={onOpenPricing}
                          className="px-2.5 py-1 rounded-[8px] bg-surface-container-lowest font-bold text-[11.5px] shadow-xs hover:bg-surface-container transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <AppIcon name="verified" className="text-[14px]" />
                          <span>Ver Planos Disponíveis</span>
                        </button>
                      )
                    ) : null}

                    {item.message.toLowerCase().includes('suporte') ||
                    item.message.toLowerCase().includes('atendimento') ||
                    item.message.toLowerCase().includes('whatsapp') ? (
                      onOpenSupport && (
                        <button
                          type="button"
                          onClick={onOpenSupport}
                          className="px-2.5 py-1 rounded-[8px] bg-surface-container-lowest font-bold text-[11.5px] shadow-xs hover:bg-surface-container transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <AppIcon name="support_agent" className="text-[14px]" />
                          <span>Falar com Suporte</span>
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="w-7 h-7 rounded-[8px] bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 flex items-center justify-center shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                title="Dispensar aviso"
                aria-label="Dispensar comunicado"
              >
                <AppIcon name="close" className="text-[16px]" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
