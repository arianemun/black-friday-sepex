import "server-only";
import fs from "node:fs";
import path from "node:path";
import { stores } from "./catalog";

/**
 * Store logos are optional files in public/stores/<key>.(svg|png|webp).
 * Use the stores' own official logo files; without one, a text tile is shown.
 */
export function storeLogos(): Record<string, string> {
  const dir = path.join(process.cwd(), "public", "stores");
  const out: Record<string, string> = {};
  for (const s of stores) {
    for (const ext of ["svg", "png", "webp"]) {
      if (fs.existsSync(path.join(dir, `${s.key}.${ext}`))) {
        out[s.key] = `/stores/${s.key}.${ext}`;
        break;
      }
    }
  }
  return out;
}
