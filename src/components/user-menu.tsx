import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import type { AuthUser } from '../auth';

interface UserMenuProps {
  user: AuthUser;
  onLogout: () => Promise<void> | void;
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const menuItems: MenuProps['items'] = [
    ...(user.roles?.length
      ? [
          {
            key: 'role-info',
            label: `角色：${user.roles.join(' / ')}`,
            disabled: true,
          },
          { type: 'divider' as const },
        ]
      : []),
    {
      key: 'logout',
      label: '退出登录',
      danger: true,
      onClick: () => {
        void onLogout();
      },
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomLeft">
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          marginLeft: 16,
          borderRadius: 999,
          border: '1px solid rgba(108, 184, 255, 0.45)',
          background: 'rgba(14, 23, 38, 0.72)',
          color: '#f0f6ff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
        }}
      >
        <span>{user.displayName || user.username}</span>
        <span style={{ fontSize: 10, opacity: 0.8 }}>▼</span>
      </button>
    </Dropdown>
  );
}
