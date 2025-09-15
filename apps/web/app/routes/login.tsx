import * as React from 'react';
import { useNavigate } from 'react-router';
import { api, setAuth, type LoginResponse } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    try {
      const resp = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuth(resp);
      navigate('/app');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Sign in</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          name="email"
          type="email"
          placeholder="email"
          className="border p-2 w-full"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="password"
          className="border p-2 w-full"
          required
        />
        <button disabled={busy} className="border px-3 py-2 w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
