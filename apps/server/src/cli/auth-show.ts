/**
 * Print the app bearer token for the configured data dir.
 */
import { loadConfig } from "../config.js";
import { ensureDataLayout, resolveDataPaths } from "../platform/files.js";
import { loadOrCreateAppToken, readAppTokenFile } from "../platform/secrets.js";

const config = loadConfig();
const paths = resolveDataPaths(config.dataDir);
ensureDataLayout(paths);

if (config.appTokenOverride) {
  console.log(config.appTokenOverride);
  console.error("(from AIGEN_APP_TOKEN)");
  process.exit(0);
}

const existing = readAppTokenFile(paths);
if (existing) {
  console.log(existing);
  console.error(`(from ${paths.appTokenFile})`);
  process.exit(0);
}

const { token } = loadOrCreateAppToken(paths, null);
console.log(token);
console.error(`(generated at ${paths.appTokenFile})`);
