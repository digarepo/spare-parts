import * as React from 'react';
import { redirect, useLoaderData } from 'react-router';

import { api, type MeResponse, type TenantOverviewResponse } from '../lib/api';
import { storage } from '../lib/storage';

type AppData = { me: MeResponse; overview: TenantOverviewResponse };

export async function clientLoader(): Promise<AppData | Response> {
  const token = storage.getItem('access_token');
  if (!token) return redirect('/login');

  const me = await api<MeResponse>('/auth/me');
  const overview = await api<TenantOverviewResponse>(`/tenants/${me.tenantId}/overview`);
  return { me, overview };
}

export default function AppShell() {
  const { me, overview } = useLoaderData<AppData>();
  return (
    <div className="p-6">
      <div className="mb-4 text-sm">
        Signed in as <b>{me.email}</b>
      </div>
      <h1 className="text-2xl font-bold">Tenant: {overview.tenant?.name ?? '(unknown)'}</h1>
    </div>
  );
}
