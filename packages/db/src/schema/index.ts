export * from './iam';
export * from './rbac';
export * from './catalog';
export * from './auth';
export * from './inventory';
export * from './reservations';

import * as auth from './auth';
import * as catalog from './catalog';
import * as iam from './iam';
import * as inventory from './inventory';
import * as rbac from './rbac';
import * as reservations from './reservations';

export const schema = { ...iam, ...rbac, ...catalog, ...auth, ...inventory, ...reservations };
