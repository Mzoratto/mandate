import { createHash } from "node:crypto";
import type { Mandate, MandateEvent } from "./types.js";

function assertValidUnicode(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError("Canonical JSON rejects lone surrogates");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError("Canonical JSON rejects lone surrogates");
    }
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError("Canonical JSON accepts only plain objects");
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    for (const key of keys) assertValidUnicode(key);
    return `{${keys
      .map((key) => {
        const item = record[key];
        if (item === undefined) throw new TypeError(`Canonical JSON rejects undefined at ${key}`);
        return `${JSON.stringify(key)}:${canonicalJson(item)}`;
      })
      .join(",")}}`;
  }
  throw new TypeError(`Canonical JSON rejects ${typeof value}`);
}

export function sha256Digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function immutableMandateContent(mandate: Mandate): Omit<Mandate, "status" | "approvedAt" | "completedAt"> {
  const { status: _status, approvedAt: _approvedAt, completedAt: _completedAt, ...content } = mandate;
  return content;
}

export function mandateVersionDigest(mandate: Mandate): string {
  return sha256Digest(immutableMandateContent(mandate));
}

export function eventDigest(event: Omit<MandateEvent, "eventHash">): string {
  return sha256Digest(event);
}

export function deterministicId(prefix: string, value: unknown): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,31}$/.test(prefix)) {
    throw new TypeError("Invalid deterministic ID prefix");
  }
  return `${prefix}-${sha256Digest(value).slice("sha256:".length, "sha256:".length + 24)}`;
}

export function frozenSnapshot<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  };
  freeze(clone);
  return clone;
}
