import { useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

type LoaderData = {
  ok: boolean;
  raw?: unknown;
  error?: string;
};

export async function loader(_args: LoaderFunctionArgs): Promise<LoaderData> {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/health`, { headers: { accept: 'application/json' } });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const json = await res.json().catch(() => ({}));
  return { ok: Boolean((json as any)?.ok), raw: json };
}

export default function HealthPage() {
  const data = useLoaderData() as LoaderData;
  return (
    <main style={{ padding: 24 }}>
      <h2>API Health</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <p>
        Status:{' '}
        <strong style={{ color: data.ok ? 'green' : 'red' }}>{data.ok ? 'UP' : 'DOWN'}</strong>
      </p>
    </main>
  );
}
