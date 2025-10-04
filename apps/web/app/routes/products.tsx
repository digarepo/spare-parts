import { type LoaderFunctionArgs, useLoaderData, Link, useSearchParams } from 'react-router-dom';

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  currency: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
};
type ListResp = { items: Product[]; page: number; pageSize: number; total: number; pages: number };

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') ?? '1';
  const pageSize = url.searchParams.get('pageSize') ?? '12';
  const apiBase = import.meta.env.VITE_API_BASE as string;

  // Forward cookie (server) → Authorization header used by API (if you set it there).
  const headers: HeadersInit = {};
  const auth = request.headers.get('cookie')?.match(/access_token=([^;]+)/)?.[1];
  if (auth) headers['Authorization'] = `Bearer ${auth}`;

  const res = await fetch(`${apiBase}/catalog/products?page=${page}&pageSize=${pageSize}`, {
    headers,
  });
  if (!res.ok)
    throw new Response('Failed to load products', {
      status: res.status,
      statusText: 'Failed to load products',
    });
  const data = (await res.json()) as ListResp;
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export default function ProductsPage() {
  const data = useLoaderData() as ListResp;
  const [params] = useSearchParams();
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '12');

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <ul className="grid gap-4 md:grid-cols-2">
        {data.items.map((p) => (
          <li key={p.id} className="border rounded p-4">
            <h2 className="font-semibold">
              <Link to={`/products/${p.slug}`}>{p.name}</Link>
            </h2>
            <div className="text-sm opacity-75">{p.sku}</div>
            <div className="mt-2">
              {p.price} {p.currency}
            </div>
          </li>
        ))}
      </ul>

      <nav className="flex items-center gap-3 mt-6">
        <span className="text-sm">
          Page {data.page} / {data.pages}
        </span>
        <Link
          to={`?page=${Math.max(1, page - 1)}&pageSize=${pageSize}`}
          className={`px-3 py-1 border rounded ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
        >
          Prev
        </Link>
        <Link
          to={`?page=${Math.min(data.pages, page + 1)}&pageSize=${pageSize}`}
          className={`px-3 py-1 border rounded ${page >= data.pages ? 'pointer-events-none opacity-50' : ''}`}
        >
          Next
        </Link>
      </nav>
    </main>
  );
}
