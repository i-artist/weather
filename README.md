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

For an intranet deployment, build the application image once and configure the
external Windy proxy when the container starts:

```bash
make package-intranet
mkdir -p dist/intranet
tar -xzf dist/weather-pro-intranet-linux-amd64.tar.gz -C dist/intranet
cd dist/intranet
docker load -i weather-pro-linux-amd64.tar
cp .env.intranet.example .env
docker compose --env-file .env -f docker-compose.intranet.yml up -d
```

`make package-amd64` always builds for `linux/amd64`, including when it runs on
an ARM Mac. Override the image name or output file when needed:

```bash
make package-amd64 IMAGE=weather-pro:v1 PACKAGE_OUTPUT=release/weather-pro-v1.tar
```

The packaging script uses Docker image mirrors by default. Override them with
`NODE_IMAGE` and `NGINX_IMAGE` when the build environment has its own registry.
It also copies `docker-compose.intranet.yml` and `.env.intranet.example` into
the output directory so the intranet deployment does not need the source tree.
`make package-intranet` wraps all four deployment files into one archive for
transfer into the intranet.

The browser continues to use same-origin `/windy/*` URLs. Nginx inside the
container forwards those requests to `WINDY_PROXY_UPSTREAM`, so the intranet
only needs outbound access to that one origin and no browser CORS changes. Add
the intranet frontend hostname to `WINDY_ALLOWED_APP_HOSTS` on the external
proxy before starting the intranet container.

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
