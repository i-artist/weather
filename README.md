# Weather Pro

React weather dashboard with a Python realtime-data service and a standalone
Windy reverse proxy.

## Windy proxy

The browser loads Windy through the same-origin `/windy` route. The standalone
proxy injects `WINDY_API_KEY` during authentication, rewrites Windy's SDK and
runtime resource URLs, streams binary tiles, and rejects non-allowlisted
upstream hosts.

For local development, start the three processes separately:

```bash
(cd windy-proxy && WINDY_API_KEY=your-key \
  WINDY_ALLOWED_APP_HOSTS=localhost,127.0.0.1 go run .)
PORT=8182 .venv/bin/python server.py
npm run dev -- --host 127.0.0.1
```

For production deployment, the Docker image builds the frontend internally. The
host only needs Docker, Docker Compose, and Make:

```bash
make init
# Set WINDY_API_KEY and the licensed production hostname in .env.
make up
```

No host Node.js, Go, or Python installation is required. The application is
exposed on `WEATHER_PORT` (port `8080` by default). Use `make logs`, `make ps`,
`make health`, and `make down` for routine operations. See
[`windy-proxy/README.md`](windy-proxy/README.md) for proxy configuration.
The default npm, Alpine, and PyPI registries use mirrors reachable from mainland
China and can be overridden in `.env` when required.

To run only the standalone Windy proxy without the dashboard or Python API:

```bash
make proxy-up
make proxy-health
```

The proxy listens on `WINDY_PROXY_PORT` (port `8024` by default) and exposes
its own service information at `/`, with other unprefixed routes forwarded
directly to the Windy API. It also exposes
`/windy/libBoot.js`, `/windy/upstream/*`, and `/windy/health` for SDK traffic
and health checks.

## Frontend development

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
