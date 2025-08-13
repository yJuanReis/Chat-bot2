//
// SPDX-FileCopyrightText: Hadad <hadad@linuxmail.org>
// SPDX-License-Identifier: Apache-2.0
//

import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import path from "path";
import { PORT } from "./src/backend/config.js";
import attachWss from "./src/backend/request.js";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cookies.
app.use(cookieParser());

// Root.
app.get("/", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "src/frontend/loader.html"));
});

// Assets.
app.use("/assets", express.static(path.resolve("assets")));

// SEO.
app.get("/robots.txt", (_req, res) => {
  res.sendFile(path.resolve("src/crawlers/robots.txt"));
});  // https://umint-ai.hf.space/robots.txt

app.get("/sitemap.xml", (_req, res) => {
  res.sendFile(path.resolve("src/crawlers/sitemap.xml"));
});  // https://umint-ai.hf.space/sitemap.xml

app.get("/google15aba15fe250d693.html", (_req, res) => {
  res.sendFile(path.resolve("src/webmasters/google.html"));
});  // https://umint-ai.hf.space/google15aba15fe250d693.html

app.get("/BingSiteAuth.xml", (_req, res) => {
  res.sendFile(path.resolve("src/webmasters/bing.xml"));
});  // https://umint-ai.hf.space/BingSiteAuth.xml

// Attach WebSocket server.
attachWss(server);

server.listen(PORT);