import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    build: {
      // outDir: 'build/client'
      outDir: 'dist',
      target: 'es2015',
      assetsDir: 'static',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('antd') || id.includes('@ant-design')) return 'antd'
            if (
              id.includes('highlight.js') ||
              id.includes('markdown-it') ||
              id.includes('katex') ||
              id.includes('@traptitech')
            ) {
              return 'markdown'
            }
            if (id.includes('react-quill') || id.includes('/quill/')) return 'quill'
            if (id.includes('ace-builds') || id.includes('react-ace')) return 'ace'
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src')
      }
    },
    css: {
      modules: {
        localsConvention: 'dashesOnly'
      },
      preprocessorOptions: {
        less: {
          modifyVars: {
            // hack: `true; @import (reference) "${resolve('src/styles/index.less')}";`,
          },
          javascriptEnabled: true
        }
      }
    },
    server: {
      host: '0.0.0.0',
      hmr: true,
      proxy: {
        '/llm': {
          target: env.VITE_LLM_PROXY_TARGET || 'https://your-llm-domain.example.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/llm/, '')
        }
      }
    }
  }
})
