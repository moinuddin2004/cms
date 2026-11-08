import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    /**
     * Client-only build. The app talks to the NestJS API directly (no server
     * functions, no server loaders), so the Nitro server only ever shipped
     * the shell. SPA mode prerenders that shell as `index.html`, which is what
     * the static web host and the Tauri desktop shell both serve.
     */
    tanstackStart({
      spa: {
        enabled: true,
        // Emit the shell as `index.html` instead of `_shell.html`: both
        // static hosts (nginx `try_files … /index.html`) and Tauri's asset
        // fallback resolve unknown paths to that name.
        prerender: { outputPath: '/index' },
      },
    }),
    viteReact(),
  ],
})

export default config
