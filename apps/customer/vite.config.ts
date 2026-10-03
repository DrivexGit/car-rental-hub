import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Serves api/*.ts in dev the same way Vercel does in production.
const devApi = () => ({
  name: "dev-api",
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (!req.url?.startsWith("/api/")) return next();
      const name = req.url.slice(5).split("?")[0];
      const mod = await server.ssrLoadModule(`/api/${name}.ts`);
      const body = await new Promise<string>((r) => { let b = ""; req.on("data", (c: any) => (b += c)); req.on("end", () => r(b)); });
      const out: Response = await mod[req.method](new Request("http://local" + req.url, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : body }));
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(await out.text());
    });
  },
});

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), devApi()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: { port: 9191 },
  };
});
