import type { EstimateRequest, EstimateResult } from "./api";
import type { CountryInfo } from "./countries";

export type Message =
  | { type: "estimate"; request: EstimateRequest }
  | { type: "countries"; refresh?: boolean }
  | { type: "usage" }
  | { type: "clearCache" }
  | { type: "openOptions" };

export interface Usage {
  hasKey: boolean;
  usedToday: number;
  perDay: number;
  cachedEstimates: number;
  /** No key and today's anonymous allowance is used up (or the API said so): time to suggest a free key. */
  limitReached: boolean;
}

export type Reply<M extends Message> = M extends { type: "estimate" }
  ? EstimateResult
  : M extends { type: "countries" }
    ? CountryInfo[]
    : M extends { type: "usage" }
      ? Usage
      : { ok: boolean };
