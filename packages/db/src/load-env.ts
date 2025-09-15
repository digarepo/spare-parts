import path from 'node:path';

import { config } from 'dotenv';

const explicit = process.env.DOTENV_PATH; // optional override
const rootEnv = explicit ?? path.resolve(__dirname, '../../../.env');
config({ path: rootEnv });
