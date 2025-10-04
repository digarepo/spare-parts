import { type RouteConfig, route } from '@react-router/dev/routes';

const routes = [
  route('/', './routes/home.tsx'),
  route('/health', './routes/health.tsx'),
  route('/login', './routes/login.tsx'),
  route('/app', './routes/app.tsx'),
  route('/products', './routes/products.tsx'),
  route('/products/:slug', './routes/product.$slug.tsx'),
] satisfies RouteConfig;

export default routes;
