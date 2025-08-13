//
// SPDX-FileCopyrightText: Hadad <hadad@linuxmail.org>
// SPDX-License-Identifier: Apache-2.0
//

import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import {
  OPENAI_API_BASE_URL,
  OPENAI_API_KEY
} from "./config.js";

export default function attachWss(server) {
  const wss = new WebSocketServer({ server });

  // Handle WebSocket connections.
  wss.on("connection", (ws) => {
    let currentAbortController = null;

    // Send messages to client.
    const sendToClient = (type, payload) => {
      ws.send(JSON.stringify({ type, ...payload }));
    };

    // Send logs to client.
    const sendError = (message) => {
      sendToClient("error", { error: message });
    };

    // Make a request.
    const streamRequest = async (messages, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;

        try {
          const response = await fetch(OPENAI_API_BASE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4.1-nano",
              messages,
              stream: true,
              private: true,
              isPrivate: true
            }),
            signal
          });

          if (response.status === 502) {
            if (attempt === retries) {
              sendError(
                "The server is currently busy. Please wait a moment or try again later."
              );
              return;
            }
            continue;
          }

          if (!response.ok) {
            const errText = await response.text();
            sendError(`HTTP ${response.status}: ${response.statusText} - ${errText}`);
            return;
          }

          if (!response.body) {
            sendError("Response body is empty.");
            return;
          }

          let buffer = "";
          for await (const chunk of response.body) {
            if (signal.aborted) {
              sendToClient("end", {});
              return;
            }
            buffer += chunk.toString();
            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);
              if (line.startsWith("data: ")) {
                const dataStr = line.substring(6).trim();
                if (!dataStr || dataStr === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  const part = parsed?.choices?.[0]?.delta?.content;
                  if (part) sendToClient("chunk", { chunk: part });
                } catch (err) {
                  sendError(`Parse error: ${err.message}`);
                }
              }
            }
          }

          sendToClient("end", {});
          return;
        } catch (err) {
          if (signal.aborted) {
            sendToClient("end", {});
            return;
          }
          if (attempt === retries) {
            sendError(err.message || "Unknown error.");
          }
        }
      }
    };

    // Handle messages from client.
    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        if (data.type === "stop") {
          if (currentAbortController) currentAbortController.abort();
          sendToClient("end", {});
          return;
        }

        const message = data.message;
        const history = data.history || [];
        const setupMessages = [...history, { role: "user", content: message }];
        await streamRequest(setupMessages);

      } catch (err) {
        sendError(err.message || "An unknown error occurred.");
        if (currentAbortController) currentAbortController.abort();
      }
    });

    // Abort on WebSocket close.
    ws.on("close", () => {
      if (currentAbortController) currentAbortController.abort();
    });
  });
}