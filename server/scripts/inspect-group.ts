// Usage: bun scripts/inspect-group.ts <frost-client config.toml>
import { groupInfo } from "../src/frost";

const config = process.argv[2];
if (!config) throw new Error("usage: bun scripts/inspect-group.ts <config.toml>");
console.log(JSON.stringify(await groupInfo(config), null, 2));
