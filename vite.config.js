import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/tabular-soil-data-annotation/', 
  plugins: [vue()],
  server: {
    port: 5173
  }
})