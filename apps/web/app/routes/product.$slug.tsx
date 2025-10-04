import { type LoaderFunctionArgs } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { useTypedLoaderData } from '../lib/useTypedLoaderData';

const ProductDetailSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  price: z.string(),
  currency: z.string(),
  status: z.string(),
  shortDesc: z.string().optional(),
  description: z.string().optional(),
  primaryImage: z
    .object({ url: z.string().url(), alt: z.string().optional() })
    .nullable()
    .optional(),
});

const ProductDetailResponseSchema = z.object({
  product: ProductDetailSchema,
});

type ProductDetailResponse = z.infer<typeof ProductDetailResponseSchema>;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const apiBase = import.meta.env.VITE_API_BASE as string;
  const headers: HeadersInit = {};
  const auth = request.headers.get('cookie')?.match(/access_token=([^;]+)/)?.[1];
  if (auth) headers['Authorization'] = `Bearer ${auth}`;

  const res = await fetch(`${apiBase}/catalog/products/${params.slug}`, { headers });
  if (res.status === 404) throw new Response('Not found', { status: 404 });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Failed to load product');
    throw new Response(msg || 'Failed to load product', { status: res.status });
  }

  const parsed = ProductDetailResponseSchema.parse((await res.json()) as unknown);

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export default function ProductDetailPage() {
  const { product: p } = useTypedLoaderData<ProductDetailResponse>();

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <Link to="/products" className="text-sm opacity-70">
        ← Back to products
      </Link>
      <h1 className="text-2xl font-bold mt-2">{p.name}</h1>
      <div className="opacity-75 text-sm">{p.sku}</div>
      <div className="mt-2 text-lg">
        {p.price} {p.currency}
      </div>
      {p.primaryImage ? (
        <img
          src={p.primaryImage.url}
          alt={p.primaryImage.alt ?? p.name}
          className="mt-4 max-h-64 object-contain"
        />
      ) : null}
      {p.shortDesc && <p className="mt-4">{p.shortDesc}</p>}
      {p.description && (
        <article className="prose mt-4" dangerouslySetInnerHTML={{ __html: p.description }} />
      )}
    </main>
  );
}
