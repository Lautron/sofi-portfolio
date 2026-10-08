import { registerHooks } from 'node:module'

// Source modules use Vite's extensionless relative imports; Node's native
// TypeScript support needs the `.ts` suffix to resolve them.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (!specifier.startsWith('.')) throw error
      return nextResolve(`${specifier}.ts`, context)
    }
  },
})
