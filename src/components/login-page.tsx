import { Button, Result, Spin } from 'antd';
import { useState } from 'react';

interface LoginPageProps {
  loading?: boolean;
  errorMessage?: string | null;
}

export default function LoginPage({ loading = false, errorMessage }: LoginPageProps) {
  const [closeHint, setCloseHint] = useState('');

  const closeCurrentPage = () => {
    setCloseHint('');
    window.close();
    window.setTimeout(() => {
      setCloseHint('浏览器未允许自动关闭，请手动关闭当前页面，或从申能门户重新进入');
    }, 300);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'radial-gradient(120% 120% at 20% 20%, rgba(38, 63, 108, 0.85) 0%, rgba(14, 23, 38, 0.96) 55%, rgba(7, 12, 20, 0.99) 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          padding: '36px 32px 28px',
          borderRadius: 18,
          background: 'rgba(18, 32, 54, 0.84)',
          border: '1px solid rgba(108, 184, 255, 0.35)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
            <Spin size="large" />
            <span style={{ color: '#c8d7ed', fontSize: 15 }}>正在进行单点登录...</span>
          </div>
        ) : (
          <Result
            status={errorMessage ? 'error' : 'info'}
            title={
              <span style={{ color: '#f0f6ff' }}>
                {errorMessage ? '单点登录失败' : '请通过单点登录访问'}
              </span>
            }
            subTitle={
              <span style={{ color: '#94a9c9' }}>
                {errorMessage || '缺少 SSO 登录凭证，请从申能门户进入天气资源预报系统'}
              </span>
            }
            extra={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Button type="primary" onClick={closeCurrentPage}>
                  关闭当前页面
                </Button>
                {closeHint && (
                  <span style={{ color: '#94a9c9', fontSize: 12 }}>{closeHint}</span>
                )}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
