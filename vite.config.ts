import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  // Use Function-wrapped import to prevent transpilers (like esbuild/tsc)
  // from rewriting dynamic import() to require(), avoiding ERR_REQUIRE_ESM in CommonJS mode.
  const loadModule = async (name: string) => {
    const mod = await Function(`return import("${name}")`)();
    return mod.default || mod;
  };

  const react = await loadModule('@vitejs/plugin-react');
  const tailwindcss = await loadModule('@tailwindcss/vite');

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env': '{}',
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
