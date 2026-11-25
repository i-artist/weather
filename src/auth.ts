import axios from 'axios';

export interface AuthUser {
  username: string;
  displayName: string;
  roles: string[];
}

const authClient = axios.create({
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function extractErrorMessage(error: unknown, fallback = 'SSO 登录失败，请重新登录'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; error?: string; message?: string; msg?: string } | undefined;
    const msg = data?.detail || data?.error || data?.message || data?.msg;
    if (typeof msg === 'string' && msg.trim()) {
      return msg.trim();
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function extractSsoTokenFromLocation(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const directToken = searchParams.get('token')?.trim();
  if (directToken) {
    return directToken;
  }

  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex !== -1) {
    const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
    const hashToken = hashParams.get('token')?.trim();
    if (hashToken) {
      return hashToken;
    }
  }

  return null;
}

export function clearSsoParamsFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  url.searchParams.delete('redirectUrl');

  if (url.pathname === '/auth/sso-login') {
    url.pathname = '/';
  }

  if (url.hash.includes('?')) {
    const [hashPath, hashQuery] = url.hash.split('?', 2);
    const hashParams = new URLSearchParams(hashQuery);
    hashParams.delete('token');
    hashParams.delete('redirectUrl');
    const nextHashQuery = hashParams.toString();
    url.hash = nextHashQuery ? `${hashPath}?${nextHashQuery}` : hashPath;
  }

  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

export interface AuthStatus {
  authenticated: boolean;
  ssoEnabled: boolean;
  user: AuthUser | null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const response = await authClient.get<AuthStatus>('/api/auth/me');
    return {
      authenticated: Boolean(response.data?.authenticated),
      ssoEnabled: response.data?.ssoEnabled ?? true,
      user: response.data?.user ?? null,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return { authenticated: false, ssoEnabled: true, user: null };
    }
    throw error;
  }
}

export async function ssoLogin(token: string): Promise<AuthUser> {
  const response = await authClient.post<{ authenticated: boolean; user: AuthUser }>(
    '/api/auth/sso-login',
    { token },
  );
  return response.data.user;
}

export async function logout(): Promise<void> {
  await authClient.post('/api/auth/logout');
}
