import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "frontend", "dist");
const target = resolve(root, "public");

await mkdir(target, { recursive: true });
for (const path of ["_expo", "assets", "index.html", "metadata.json", "favicon.ico"]) {
  await rm(resolve(target, path), { recursive: true, force: true });
}
await cp(source, target, { recursive: true });
console.log("Frontend Expo sincronizado em public/.");
