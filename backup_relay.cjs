#!/usr/bin/env node
// backup_relay.cjs - minimalis relay: POST /save kap egy JSON-t (localStorage tartalom),
// elmenti rclone-val a Google Drive-ra. CSOK: nem tarol tokent, csak ir a drive:-ba.
// Inditas: node backup_relay.cjs  [PORT=auto 8766]
const http = require("http");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = process.env.BACKUP_PORT || 8766;
const REMOTE = "drive:/chatgpt-usage/chatgpt_usage_v1.json";
const TMP = path.join(os.tmpdir(), "chatgpt_backup_tmp.json");

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/save") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try {
        const obj = JSON.parse(body);
        if (!obj || typeof obj !== "object") throw new Error("nem objektum");
        fs.writeFileSync(TMP, JSON.stringify(obj, null, 2));
        execFileSync("rclone", ["copyto", TMP, REMOTE], { timeout: 30000 });
        fs.unlinkSync(TMP);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ts: Date.now() }));
        console.log("Backup mentve ->", REMOTE);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, err: String(e.message || e) }));
        console.error("Backup hiba:", e.message || e);
      }
    });
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200); res.end("ok");
  } else if (req.method === "GET" && req.url === "/load") {
    try {
      const out = execFileSync("rclone", ["cat", REMOTE], { timeout: 30000, encoding: "utf8" });
      const obj = JSON.parse(out);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ts: Date.now(), data: obj }));
      console.log("Backup betoltve <-", REMOTE);
    } catch (e) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, err: String(e.message || e) }));
    }
  } else {
    res.writeHead(404); res.end("not found");
  }
});

server.listen(PORT, () => console.log(`backup_relay fut: http://127.0.0.1:${PORT}/save`));
