import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router-dom';

type Health = { ok: boolean };

const API: string =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env['VITE_API_URL'] ??
  'http://localhost:3000';

function isHealth(value: unknown): value is Health {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.ok === 'boolean';
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Health> {
  void request;

  const res = await fetch(`${API}/health`, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Response(JSON.stringify({ message: 'API health check failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data: unknown = await res.json();
  if (!isHealth(data)) {
    throw new Response(JSON.stringify({ message: 'Unexpected API response' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return data;
}

export default function HealthRoute() {
  const data = useLoaderData<Health>();
  return (
    <div style={{ padding: 16 }}>
      <h2>Health</h2>
      <p>API OK: {String(data.ok)}</p>
    </div>
  );
}
