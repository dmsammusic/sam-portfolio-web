import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const root = dirname(fileURLToPath(import.meta.url));

// Inlines <!-- @include "partials/header.html" --> comments with the
// referenced file's contents, recursively, at build time. Keeps every
// page plain static HTML in the output — no client-side templating.
function htmlIncludes() {
  const includeRe = /<!--\s*@include\s+"([^"]+)"\s*-->/g;

  function resolveIncludes(html, depth = 0) {
    if (depth > 10) throw new Error("htmlIncludes: include depth exceeded (possible cycle)");
    return html.replace(includeRe, (_match, relPath) => {
      const partialPath = join(root, relPath);
      const partial = readFileSync(partialPath, "utf-8");
      return resolveIncludes(partial, depth + 1);
    });
  }

  return {
    name: "html-includes",
    transformIndexHtml: {
      // Runs before Vite's own asset-URL resolution, so tags introduced
      // by partials (e.g. <script src="/src/js/nav.js">) still get processed.
      order: "pre",
      handler(html) {
        return resolveIncludes(html);
      },
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), htmlIncludes()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        portfolio: resolve(root, "portfolio.html"),
        keygen: resolve(root, "keygen.html"),
        todo: resolve(root, "todo.html"),
        insights: resolve(root, "insights.html"),
        settings: resolve(root, "settings.html"),
        taskManager: resolve(root, "task-manager.html"),
        timeCalculator: resolve(root, "time-calculator.html"),
        jsonFormattor: resolve(root, "json-formattor.html"),
        blog: resolve(root, "blog.html"),
        blogMyJourney: resolve(root, "blogs/1.my-journey.html"),
        blogPasswordSecurity: resolve(root, "blogs/2.password-security.html"),
        notFound: resolve(root, "404.html"),
      },
    },
  },
});
