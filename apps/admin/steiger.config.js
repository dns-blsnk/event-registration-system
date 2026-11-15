import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

/** Feature-Sliced Design rules for the admin's layers; the test helpers sit outside the layers. */
export default defineConfig([...fsd.configs.recommended, { ignores: ['**/test/**'] }]);
