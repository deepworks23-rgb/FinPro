import type { AppScreen } from '../types/finance';

/**
 * Maps a URL pathname to an internal AppScreen.
 * Handles root (/), /login, /admin, and /app/* sub-paths.
 */
export function pathToScreen(pathname: string): AppScreen {
  if (!pathname || typeof pathname !== 'string') return 'landing';

  // Normalize path by stripping trailing slashes
  const cleanPath = pathname.trim().toLowerCase().replace(/\/+$/, '') || '/';

  if (cleanPath === '/' || cleanPath === '/landing' || cleanPath === '/home') {
    return 'landing';
  }
  if (cleanPath === '/login' || cleanPath === '/entrar' || cleanPath === '/auth' || cleanPath === '/registar') {
    return 'login';
  }
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    return 'admin';
  }
  if (cleanPath === '/app/transacoes' || cleanPath === '/app/extrato') {
    return 'transacoes';
  }
  if (cleanPath === '/app/orcamentos' || cleanPath === '/app/metas') {
    return 'orcamentos';
  }
  if (cleanPath === '/app/relatorios' || cleanPath === '/app/relatorio') {
    return 'relatorios';
  }
  if (cleanPath === '/app/perfil' || cleanPath === '/app/conta') {
    return 'perfil';
  }
  if (cleanPath === '/app' || cleanPath.startsWith('/app/')) {
    return 'dashboard-inicio';
  }

  // Default for root, unknown paths, or Capacitor local index.html
  return 'landing';
}

/**
 * Maps an internal AppScreen to a clean browser URL pathname.
 */
export function screenToPath(screen: AppScreen): string {
  switch (screen) {
    case 'landing':
      return '/';
    case 'login':
      return '/login';
    case 'admin':
      return '/admin';
    case 'dashboard-inicio':
      return '/app';
    case 'transacoes':
      return '/app/extrato';
    case 'orcamentos':
      return '/app/orcamentos';
    case 'relatorios':
      return '/app/relatorios';
    case 'perfil':
      return '/app/perfil';
    default:
      return '/app';
  }
}

/**
 * Safely updates browser URL using HTML5 History API without page reload.
 */
export function syncBrowserPath(screen: AppScreen, replace = false): void {
  if (typeof window === 'undefined' || !window.history) return;

  const targetPath = screenToPath(screen);
  const currentPath = window.location.pathname;

  // Do not rewrite if already on this path
  if (currentPath === targetPath) return;

  try {
    if (replace) {
      window.history.replaceState({ screen }, '', targetPath);
    } else {
      window.history.pushState({ screen }, '', targetPath);
    }
  } catch {
    // Graceful fallback for iframe or file:// sandbox environments
  }
}
