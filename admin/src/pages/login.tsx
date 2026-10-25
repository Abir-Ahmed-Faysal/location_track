import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { adminApi } from '../api/admin';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useMutation({
    mutationFn: () => adminApi.login(email.trim(), password),
    onSuccess: async () => {
      setNotice('Signed in. Checking administrator access…');
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      navigate((location.state as { from?: string } | null)?.from || '/admin', { replace: true });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    login.mutate();
  }
  const error = login.error;
  const message = error instanceof ApiError && error.status === 401
    ? 'Email or password is incorrect.'
    : error?.message;

  return <main className="login-page">
    <div className="login-left">
      <a href="/login" className="brand login-brand"><span className="brand-mark">U</span><span><strong>Location Engine</strong><small>ADMIN CONSOLE</small></span></a>
      <div className="login-copy"><div className="eyebrow">UNIVERSAL LOCATION ENGINE</div><h1>Every signal.<br /><em>One clear view.</em></h1><p>Monitor your device fleet, review location history, and understand system activity from one secure workspace.</p><div className="login-art" aria-hidden="true"><div className="art-grid" /><div className="art-route"><i /><i /><i /><i /><b>⌖</b></div><span className="art-label">FLEET NETWORK <small>LIVE SIGNALS</small></span></div></div>
      <div className="login-foot">Read-only fleet visibility <span>·</span> Protected by administrator access</div>
    </div>
    <div className="login-right"><div className="login-form-wrap"><div className="eyebrow">ADMINISTRATOR SIGN IN</div><h2>Welcome back</h2><p className="form-subtitle">Sign in with your provisioned admin account.</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {message && <div className="form-error" role="alert">{message}</div>}
        {notice && <div className="form-notice" role="status">{notice}</div>}
        <button className="button button-primary login-submit" type="submit" disabled={login.isPending}>{login.isPending ? <><span className="spinner spinner-small" /> Signing in…</> : <>Sign in <span>→</span></>}</button>
      </form><div className="login-security"><span>◈</span> Your session is secured with an HttpOnly cookie.</div>
    </div><div className="login-copyright">© {new Date().getFullYear()} Universal Location Engine</div></div>
  </main>;
}
