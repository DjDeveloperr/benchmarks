import { bench, run } from "mitata";
import { nanoid } from "nanoid";
import { save } from "../../scripts/summary.mjs";

bench("generate id", () => nanoid(36));

await save(await run(), "bun", __dirname);