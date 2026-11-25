import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import './App.css';
import {
  type AuthUser,
  clearSsoParamsFromUrl,
  extractErrorMessage,
  extractSsoTokenFromLocation,
  getAuthStatus,
  logout,
  ssoLogin,
} from './auth';
import LoginPage from './components/login-page';
import Dashboard from './dashboard.tsx';

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      try {
        const status = await getAuthStatus();
        if (!active) return;

        if (!status.ssoEnabled) {
          setSsoEnabled(false);
          setAuthenticated(true);
          setUser(null);
          setErrorMessage(null);
          return;
        }

        setSsoEnabled(true);
        const ssoToken = extractSsoTokenFromLocation();
        if (ssoToken) {
          const loggedInUser = await ssoLogin(ssoToken);
          if (!active) return;
          clearSsoParamsFromUrl();
          setUser(loggedInUser);
          setAuthenticated(true);
          setErrorMessage(null);
          return;
        }

        if (status.authenticated && status.user) {
          setUser(status.user);
          setAuthenticated(true);
          setErrorMessage(null);
        } else {
          setUser(null);
          setAuthenticated(false);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!active) return;
        setUser(null);
        setAuthenticated(false);
        setErrorMessage(extractErrorMessage(error, 'SSO 登录失败，请重新登录'));
      } finally {
        if (active) setLoading(false);
      }
    };

    void initAuth();

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setUser(null);
          setAuthenticated(false);
          setErrorMessage('登录已过期，请重新从申能门户单点登录进入');
        }
        return Promise.reject(error);
      },
    );

    return () => {
      active = false;
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setAuthenticated(false);
      setErrorMessage(null);
    }
  }, []);

  if (loading || (ssoEnabled && !authenticated)) {
    return <LoginPage loading={loading} errorMessage={errorMessage} />;
  }

  return (
    <div className="App">
      <Dashboard user={ssoEnabled ? user : null} onLogout={handleLogout} />
    </div>
  );
}

export default App;
