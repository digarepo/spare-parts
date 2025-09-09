import { type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('/', './routes/home.tsx'),
  //   index('routes/home.tsx'),
  route('health', './routes/health.tsx'),
] satisfies RouteConfig;
