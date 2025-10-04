import type { z } from 'zod';

export async function zodFetch<TSchema extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Response(text || 'Request failed', { status: res.status });
  }
  const data = (await res.json()) as unknown;
  return schema.parse(data);
}
