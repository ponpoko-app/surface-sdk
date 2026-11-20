import { constants } from "node:fs";
import { access, chmod, copyFile, cp, lstat, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkBundlePath, checkSurface } from "./scripts/check-surface.mjs";

const sdkRoot = fileURLToPath(new URL(".", import.meta.url));
const stylesheets = { tokens: "tokens.css", components: "components.css" };

export async function buildSurface({ entry = "main.ts", assets = [], backends = [], executables = {}, styles = ["tokens", "components"] } = {}) {
  const manifestText = await readFile("surface.json", "utf8");
  const manifest = JSON.parse(manifestText);
  if (manifest.requires?.ai != null) assets = [...assets, "ai-contract.json", "ai-requests.json"];

  if (await access(".ponpoko-scaffold.json").then(() => true, () => false)) assets = [...assets, ".ponpoko-scaffold.json"];
  if (await lstat("surface.css").catch(error => { if (error.code !== "ENOENT") throw error; })) assets = [...assets, "surface.css"];
  const stage = await mkdtemp(".ponpoko-build-");
  try {
    const stagedManifest = join(stage, "surface.json");
    await writeFile(stagedManifest, manifestText);
    for (const path of new Set(["index.html", ...assets])) {
      if (path === "surface.json") continue;
      if (path !== ".ponpoko-scaffold.json" && !/^[a-z0-9_-][a-z0-9_.-]*(?:\/[a-z0-9_-][a-z0-9_.-]*)*$/i.test(path)) throw new Error(`Invalid build asset path: ${path}`);
      await cp(path, join(stage, path), { recursive: true, verbatimSymlinks: true });
    }
    for (const style of new Set(styles)) {
      if (!Object.hasOwn(stylesheets, style)) throw new Error(`Unknown SDK stylesheet: ${style}`);
      const file = stylesheets[style];
      await cp(join(sdkRoot, "ui", file), join(stage, `sdk-${file}`));
    }
    await cp(join(sdkRoot, "LICENSE"), join(stage, "ponpoko-sdk-license.txt"), { force: false, errorOnExist: true });
    await bundle([entry], stage, "browser", "main.js");
    if (backends.length) await bundle(backends, stage, "bun", "[name].js");
    for (const [kind, source] of Object.entries(executables)) {
      if (kind !== "backend" && kind !== "cli") throw new Error(`Unknown executable: ${kind}`);
      if (source === undefined) continue;
      await stageExecutable(stage, manifest[kind], kind, source);
    }
    if (Object.values(executables).some(source => source !== undefined)) {
      await writeFile(stagedManifest, JSON.stringify(manifest, null, 2) + "\n");
    }
    await checkSurface(stage);
    await replaceDist(stage);
  } finally {
    await rm(stage, { force: true, recursive: true });
  }
}

async function stageExecutable(stage, program, kind, source) {
  const command = program?.command;
  checkBundlePath(command, `${kind}.command`);
  if (!(await stat(source)).isFile()) throw new Error(`The ${kind} executable must be a regular file`);
  const extension = extname(source).toLowerCase();
  if (extension === ".exe" && extname(command).toLowerCase() !== ".exe") program.command = command + ".exe";
  const parts = program.command.split("/");
  const name = parts.pop();
  let directory = stage;
  for (const part of parts) {
    directory = join(directory, part);
    await mkdir(directory).catch(error => { if (error.code !== "EEXIST") throw error; });
    if (!(await lstat(directory)).isDirectory()) throw new Error(`Invalid executable directory: ${kind}.command`);
  }
  const output = join(directory, name);
  await copyFile(source, output, constants.COPYFILE_EXCL);
  if (process.platform !== "win32") await chmod(output, 0o755);
}

async function replaceDist(stage) {
  const backup = await mkdtemp(".ponpoko-previous-");
  const previous = join(backup, "dist");
  let restoreFailed = false;
  try {
    const hadDist = await rename("dist", previous).then(() => true, error => {
      if (error.code === "ENOENT") return false;
      throw error;
    });
    try { await rename(stage, "dist"); }
    catch (error) {
      if (hadDist) {
        try { await rename(previous, "dist"); }
        catch (restoreError) {
          restoreFailed = true;
          throw new AggregateError([error, restoreError], `Could not restore dist. The previous bundle is at ${previous}.`);
        }
      }
      throw error;
    }
  } finally {
    if (!restoreFailed) await rm(backup, { force: true, recursive: true });
  }
}

async function bundle(entrypoints, outdir, target, naming) {
  const result = await Bun.build({ entrypoints, outdir, target, naming });
  if (!result.success) throw new AggregateError(result.logs, "Surface build failed");
}
