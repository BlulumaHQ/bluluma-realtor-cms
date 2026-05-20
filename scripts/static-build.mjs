#!/usr/bin/env node
import { existsSync, copyFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const dist = join(root, "dist");
const distClient = join(dist, "client");
const distServer = join(dist, "server");

if (!existsSync(distClient)) {
  console.error("Missing dist/client/ after vite build");
  process.exit(1);
}
if (!existsSync(distServer)) {
  console.error("Missing dist/server/ after vite build");
  process.exit(1);
}

// Alias server/index.js → server/server.js for preview-server-plugin
const serverIndex = join(distServer, "index.js");
const serverServer = join(distServer, "server.js");
if (existsSync(serverIndex) && !existsSync(serverServer)) {
  copyFileSync(serverIndex, serverServer);
  console.log("Aliased dist/server/index.js → dist/server/server.js");
}

// Spawn vite preview
const port = 4910;
const preview = spawn("npx", ["vite", "preview", "--port", String(port)], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
  env: process.env,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return res;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Preview server did not respond on ${url} within ${timeoutMs}ms`);
}

try {
  const res = await waitForServer(`http://localhost:${port}/`, 30000);
  const html = await res.text();
  writeFileSync(join(distClient, "index.html"), html);
  console.log("Wrote dist/client/index.html");
} finally {
  preview.kill("SIGTERM");
  await sleep(500);
  try { preview.kill("SIGKILL"); } catch {}
}

// Flatten dist/client/* → dist/
for (const entry of readdirSync(distClient)) {
  const from = join(distClient, entry);
  const to = join(dist, entry);
  if (existsSync(to)) rmSync(to, { recursive: true, force: true });
  renameSync(from, to);
}
rmSync(distClient, { recursive: true, force: true });

// Delete dist/server entirely
rmSync(distServer, { recursive: true, force: true });

// Ensure _redirects
const redirects = join(dist, "_redirects");
if (!existsSync(redirects)) {
  copyFileSync(join(root, "public", "_redirects"), redirects);
}

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) n += countFiles(p);
    else n++;
  }
  return n;
}

console.log(`Static build complete. ${countFiles(dist)} files in dist/`);
