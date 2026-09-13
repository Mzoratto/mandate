import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Mandate, MandateAmendment } from "../packages/protocol/src/index.js";

export function fixture<T>(name: string): T {
  const path = fileURLToPath(new URL(`./fixtures/protocol-v0.1/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function checkoutMandate(): Mandate {
  return fixture<{ input: Mandate }>("valid-checkout-mandate.json").input;
}

export function childMandate(): Mandate {
  return fixture<{ input: { child: Mandate } }>("valid-child-mandate.json").input.child;
}

export function databaseAmendment(): MandateAmendment {
  return fixture<{ input: { amendment: MandateAmendment } }>("database-amendment.json").input.amendment;
}
