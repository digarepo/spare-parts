export * from './iam';
export * from './rbac';
export * from './catalog';
export * from './auth';

import * as auth from './auth';
import * as catalog from './catalog';
import * as iam from './iam';
import * as rbac from './rbac';

export const schema = { ...iam, ...rbac, ...catalog, ...auth };
