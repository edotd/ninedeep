import { registerHooks } from 'node:module';
// The app uses Vite's extensionless relative imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) return nextResolve(`${specifier}.js`, context);
    throw error;
  }
} });
