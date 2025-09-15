import { type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('/', './routes/home.tsx'),
  route('/health', './routes/health.tsx'),
  route('/login', './routes/login.tsx'),
  route('/app', './routes/app.tsx'),
] satisfies RouteConfig;
