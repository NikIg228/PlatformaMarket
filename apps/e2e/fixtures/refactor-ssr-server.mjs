import http from "node:http";
import { comparison, productId } from "../tests/product-detail.fixture.ts";

// Read-only SSR companion to the intercepted browser fixture. No database or upstream.
http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4129");
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "GET") {
    response.writeHead(405); response.end(JSON.stringify({ message: "Fixture is read-only" })); return;
  }
  if (url.pathname === "/health") { response.end(JSON.stringify({ fixture: true })); return; }
  if (url.pathname === "/api/catalog/products/" + productId + "/compare") {
    response.end(JSON.stringify(comparison)); return;
  }
  response.writeHead(503);
  response.end(JSON.stringify({ message: "SSR fixture endpoint not modeled" }));
}).listen(4129, "127.0.0.1");
