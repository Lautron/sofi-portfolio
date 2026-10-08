import { registerHooks } from 'node:module'

// Source modules use Vite's extensionless imports: relative ones need the
// `.ts` suffix for Node's native TypeScript support, and Babylon's deep
// imports (`@babylonjs/core/Maths/math.vector`) need `.js`.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (specifier.startsWith('@babylonjs/')) return nextResolve(`${specifier}.js`, context)
      if (!specifier.startsWith('.')) throw error
      return nextResolve(`${specifier}.ts`, context)
    }
  },
})
