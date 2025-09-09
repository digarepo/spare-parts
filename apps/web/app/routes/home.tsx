import type { LoaderFunctionArgs } from 'react-router';

import Welcome from '../welcome/welcome';

export function loader({ request }: LoaderFunctionArgs) {
  void request;
  return null;
}

export default function HomeRoute() {
  return <Welcome />;
}
