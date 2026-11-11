import type { Adapter } from "./types";
import { glassdoor } from "./glassdoor";
import { indeed } from "./indeed";
import { linkedin } from "./linkedin";
import { reed } from "./reed";
import { seek } from "./seek";
import { stepstone, totaljobs } from "./stepstone-group";

export type { Adapter } from "./types";

export const ADAPTERS: Record<string, Adapter> = { linkedin, indeed, glassdoor, reed, totaljobs, seek, stepstone };
