import { useLoaderData } from 'react-router-dom';

// Centralize the cast; we can suppress the lint here instead of in every route.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useTypedLoaderData<T>(): T {
  // We know our loaders return the Zod-validated shape.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  return useLoaderData() as T;
}
