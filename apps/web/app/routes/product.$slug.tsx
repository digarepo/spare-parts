import { type LoaderFunctionArgs, useLoaderData, Link } from 'react-router-dom';

type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  currency: string;
  status: string;
  shortDesc?: string;
  description?: string;
  primaryImage?: { url: string; alt?: string } | null;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const apiBase = import.meta.env.VITE_API_BASE as string;
  const headers: HeadersInit = {};
  const auth = request.headers.get('cookie')?.match(/access_token=([^;]+)/)?.[1];
  if (auth) headers['Authorization'] = `Bearer ${auth}`;

  const res = await fetch(`${apiBase}/catalog/products/${params.slug}`, { headers });
  if (res.status === 404) throw new Response('Not found', { status: 404 });

  const data = await res.json();
  if (!data.ok) throw new Response(data.error ?? 'Failed', { status: 400 });

  return data.product as ProductDetail;
}

export default function ProductDetailPage() {
  const p = useLoaderData() as ProductDetail;
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
