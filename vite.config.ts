import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run dev:fast` runs the live server with React's production build, which is several times quicker than its development one.
  // it is how the app really feels; the normal `npm run dev` adds checks that slow typing on a long chapter.
  if (mode === 'fast') process.env.NODE_ENV = 'production'
  return {
    plugins: [react()],
    // lets the dev server be reached through a tunnel while trying live sessions between two computers
    server: { allowedHosts: ['.trycloudflare.com'] },
  }
})
