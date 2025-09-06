import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
    server: {
        host: '0.0.0.0',
        port: 19001,
        allowedHosts: true,
    },
    plugins: [react(), tailwindcss()],
});
