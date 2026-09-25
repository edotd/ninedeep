import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Nine Deep always needs a live connection for room state. Keeping an app shell in a
      // service-worker cache can strand installed iOS copies on an old hashed JS bundle after
      // a deployment, which presents as a blank screen. Publish a one-time cleanup worker so
      // existing installs discard those caches and then load directly from Vercel.
      selfDestroying: true,
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Nine Deep',
        short_name: 'Nine Deep',
        description: 'A basketball GM card game — draft, deal, and coach your franchise through an era.',
        start_url: '/',
        display: 'standalone',
        background_color: '#1E2B47',
        theme_color: '#1E2B47',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
