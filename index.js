//
// SPDX-FileCopyrightText: Hadad <hadad@linuxmail.org>
// SPDX-License-Identifier: Apache-2.0
//

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";
import path from "path";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const UMINT = process.env.UMINT || ``;

app.use(cookieParser());

// Root endpoint.
app.get("/", (_req, res) => res.send(UMINT));

// Search Engine Optimization (SEO).
// Robots Exclusion Protocol.
app.get("/robots.txt", (_req, res) => {
  res.sendFile(path.resolve("src/crawlers/robots.txt"));
});  // https://umint-ai.hf.space/robots.txt
// Sitemaps.
app.get("/sitemap.xml", (_req, res) => {
  res.sendFile(path.resolve("src/crawlers/sitemap.xml"));
});  // https://umint-ai.hf.space/sitemap.xml
// Google Search Console Tools.
app.get("/google15aba15fe250d693.html", (_req, res) => {
  res.sendFile(path.resolve("src/webmasters/google.html"));
});  // https://umint-ai.hf.space/google15aba15fe250d693.html
// Bing Webmaster Tools.
app.get("/BingSiteAuth.xml", (_req, res) => {
  res.sendFile(path.resolve("src/webmasters/bing.xml"));
});  // https://umint-ai.hf.space/BingSiteAuth.xml
// End of SEO.

// Favicon.
app.get("/assets/images/favicon.ico", (_req, res) => {
  res.sendFile(path.resolve("assets/images/favicon.ico"));
});

wss.on("connection", (ws) => {
  // Abort controller for the currently active streaming request.
  let currentAbortController = null;

  // Handle incoming messages from the WebSocket client.
  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // Handle explicit stop request from client.
      if (data.type === "stop") {
        if (currentAbortController) {
          // Abort the active fetch request to stop streaming.
          currentAbortController.abort();
          currentAbortController = null;
        }
        // Notify client that streaming ended.
        ws.send(JSON.stringify({ type: "end" }));
        return;
      }

      // Extract user message and optional history for context.
      const message = data.message;
      const history = data.history || [];
      // Build messages array with history and the new user message.
      const setup_messages = [...history, { role: "user", content: message }];

      // Create a new AbortController to allow client to cancel the stream.
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;

      // Send request to the Endpoint.
      const request = await fetch(OPENAI_API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
          messages: setup_messages,
          stream: true,
          private: true,
          isPrivate: true
        }),
        signal
      });

      // Handle non 2xx responses by returning an error to the client.
      if (!request.ok) {
        const errorData = await request.text();
        ws.send(JSON.stringify({ type: "error", error: `HTTP ${request.status}: ${request.statusText} - ${errorData}` }));
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        return;
      }

      // Get the response body stream to read incremental chunks.
      const reader = request.body;
      if (!reader) {
        ws.send(JSON.stringify({ type: "error", error: "Response body is empty" }));
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        return;
      }

      // Buffer partial data between streamed chunks.
      let buffer = "";
      try {
        // Iterate over stream chunks as they arrive.
        for await (const chunk of reader) {
          // If client requested abort, stop processing and inform the client.
          if (signal.aborted) {
            ws.send(JSON.stringify({ type: "end" }));
            if (currentAbortController) {
              currentAbortController.abort();
              currentAbortController = null;
            }
            return;
          }

          // Append raw chunk text to the buffer.
          buffer += chunk.toString();

          // Process full lines separated by newline characters.
          let idx;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);

            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6).trim();
              // Skip empty events and the stream terminator.
              if (!dataStr || dataStr === "[DONE]") continue;
              try {
                // Parse JSON payload and extract incremental content.
                const parsed = JSON.parse(dataStr);
                const part = parsed?.choices?.[0]?.delta?.content;
                if (part) {
                  // Send incremental chunk to the client.
                  ws.send(JSON.stringify({ type: "chunk", chunk: part }));
                }
              } catch (parseError) {
                // Log parsing errors for debugging.
                console.error("Error parsing JSON:", parseError, "Data string:", dataStr);
              }
            }
          }
        }
      } catch (logs) {
        // If the fetch was aborted by the client, signal end.
        if (signal.aborted) {
          ws.send(JSON.stringify({ type: "end" }));
        } else {
          // For unexpected stream errors, log and notify client.
          console.error("Error:", logs);
          ws.send(JSON.stringify({ type: "error", error: "Error: " + (logs && logs.message ? logs.message : String(logs)) }));
        }
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        return;
      }

      // Normal end of stream, notify client.
      ws.send(JSON.stringify({ type: "end" }));
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
    } catch (e) {
      // Catch JSON parse errors and other unexpected exceptions.
      console.error("General error:", e);
      ws.send(JSON.stringify({ type: "error", error: e.message || "An unknown error occurred" }));
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
    }
  });

  // Ensure any active fetch is aborted when the WebSocket closes.
  ws.on("close", () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  });
});

const PORT = process.env.PORT || 7860;
// Start the HTTP and WebSocket server.
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});