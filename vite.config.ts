import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps, { hostType }) => {
        // 仅预加载 react-vendor，其他 chunk 按需加载
        if (hostType !== 'html') return deps;
        return deps.filter((d: string) => d.includes('react-vendor'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor'
            }
            if (id.includes('framer-motion')) {
              return 'animation'
            }
            if (id.includes('lucide-react') || id.includes('@radix-ui')) {
              return 'ui'
            }
            if (id.includes('pdf')) {
              return 'pdf-vendor'
            }
            if (id.includes('recharts')) {
              return 'charts'
            }
          }
          return null
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || ''
          if (info.endsWith('.css')) return 'assets/css/[name]-[hash][extname]'
          if (/\.(woff2?|ttf|otf)$/.test(info)) return 'assets/fonts/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    chunkSizeWarningLimit: 600,
    minify: true,
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react'],
  },
})
