import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Vault } from "./types";

// lean-ctx: JSON file store; upgrade to SQLite when there is more than a handful of vaults
export const DATA_DIR = process.env.ZECHEIR_DATA_DIR ?? join(import.meta.dir, "..", "..", "data");
const FILE = join(DATA_DIR, "vaults.json");

let cache: Map<string, Vault> | null = null;

async function load(): Promise<Map<string, Vault>> {
  if (cache) return cache;
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const list = JSON.parse(await readFile(FILE, "utf8")) as Vault[];
    cache = new Map(list.map((v) => [v.id, v]));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    cache = new Map();
  }
  return cache;
}

async function persist(map: Map<string, Vault>) {
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify([...map.values()], null, 2));
  await rename(tmp, FILE); // atomic replace
}

export async function listVaults(): Promise<Vault[]> {
  return [...(await load()).values()];
}

export async function getVault(id: string): Promise<Vault | undefined> {
  return (await load()).get(id);
}

export async function saveVault(vault: Vault): Promise<Vault> {
  const map = await load();
  map.set(vault.id, vault);
  await persist(map);
  return vault;
}

export async function updateVault(id: string, fn: (v: Vault) => void): Promise<Vault> {
  const vault = await getVault(id);
  if (!vault) throw new Error(`vault ${id} not found`);
  fn(vault);
  return saveVault(vault);
}
