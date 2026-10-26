import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin';

const links = [
  { to: '/admin', label: 'Overview', icon: '◫', end: true },
  { to: '/admin/map', label: 'Live map', icon: '⌖' },
  { to: '/admin/devices', label: 'Devices', icon: '▤' },
  { to: '/admin/approvals', label: 'Approvals', icon: '✓' },
];

export function AppShell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function logout() {
    try { await adminApi.logout(); } finally {
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  }
  return <div className="app-frame">
    <aside className="sidebar">
      <a href="/admin" className="brand"><span className="brand-mark">U</span><span><strong>Location Engine</strong><small>ADMIN CONSOLE</small></span></a>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">
        {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><span className="nav-icon">{link.icon}</span>{link.label}</NavLink>)}
      </nav>
      <div className="sidebar-foot"><span className="system-dot" /> API secured <span className="version-tag">v1</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Administration</strong></div>
        <div className="top-actions"><span className="secure-label"><span className="system-dot" /> Secure session</span><button className="avatar-button" aria-label="Sign out" title="Sign out" onClick={() => void logout()}>↗</button></div>
      </header>
      <div className="page-wrap"><Outlet /></div>
    </main>
  </div>;
}
