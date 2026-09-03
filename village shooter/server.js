const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const port = Number(process.env.PORT) || 8000;
const root = __dirname;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const httpServer = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(request.url.split("?")[0]);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(data);
  });
});

const webSocketServer = new WebSocket.Server({ server: httpServer });
const rooms = new Map();

webSocketServer.on("connection", socket => {
  let room = null;

  socket.on("message", rawMessage => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      return;
    }

    if (message.type === "join" && typeof message.room === "string") {
      room = message.room.slice(0, 32);
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(socket);
      return;
    }

    if (!room) return;
    for (const peer of rooms.get(room) || []) {
      if (peer !== socket && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify(message));
      }
    }
  });

  socket.on("close", () => {
    if (!room || !rooms.has(room)) return;
    rooms.get(room).delete(socket);
    if (rooms.get(room).size === 0) rooms.delete(room);
  });
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Energy Wars draait op http://localhost:${port}`);
  console.log("Gebruik voor andere apparaten het lokale IP-adres van deze pc.");
});