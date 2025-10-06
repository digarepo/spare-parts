export * from './iam';
export * from './rbac';
export * from './catalog';
export * from './inventory';
export * from './checkout';
// export * from './auth';

// import * as auth from './auth';
import * as catalog from './catalog';
import * as checkout from './checkout';
import * as iam from './iam';
import * as inventory from './inventory';
import * as rbac from './rbac';
export const schema = { ...iam, ...rbac, ...catalog, ...inventory, ...checkout };
