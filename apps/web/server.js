const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5173;
const BACKEND_PORT = process.env.CLIENT_PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
    ".html": "text/html; charset=UTF-8",
    ".css": "text/css; charset=UTF-8",
    ".js": "application/javascript; charset=UTF-8",
    ".json": "application/json; charset=UTF-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
    // 1. Proxy API requests to client backend (Port 3000)
    if (req.url.startsWith("/api/")) {
        const options = {
            hostname: "127.0.0.1",
            port: BACKEND_PORT,
            path: req.url,
            method: req.method,
            headers: req.headers
        };

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on("error", (err) => {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: `Client backend (port ${BACKEND_PORT}) is unreachable. Is the client running?`,
                error: err.message
            }));
        });

        req.pipe(proxyReq, { end: true });
        return;
    }

    // 2. Serve static files from public directory
    let filePath = path.join(
        PUBLIC_DIR,
        req.url === "/" ? "index.html" : req.url.split("?")[0]
    );

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === "ENOENT") {
                // Single page app fallback to index.html
                fs.readFile(path.join(PUBLIC_DIR, "index.html"), (readErr, indexContent) => {
                    if (readErr) {
                        res.writeHead(404, { "Content-Type": "text/plain" });
                        res.end("404 Not Found");
                    } else {
                        res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
                        res.end(indexContent, "utf-8");
                    }
                });
            } else {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(content, "utf-8");
        }
    });
});

server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`µTorrent Web UI running at http://localhost:${PORT}`);
    console.log(`Proxying API calls to client at http://localhost:${BACKEND_PORT}`);
    console.log(`===============================================`);
});
