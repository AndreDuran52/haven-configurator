// The one choke point every op goes through (§5.3):
// clone -> mutate the draft -> normalise -> refuse rule breaks -> assert.
// - Input is never mutated (the JSON clone also enforces "config is plain data").
// - A refused edit returns the SAME reference with `rejected` set (G6).
// - A no-op returns the same reference with `rejected: null`.
import { makeAlloc, runIds, type Alloc } from './layout';
import { normalizeConfig } from './normalize';
import { assertInvariants, ruleViolation } from './rules';
import type { Config, EditResult, Rejection, RunId, RunPiece } from './types';

/** What an op's body returns: true = changed, null = nothing to do, or a refusal. */
export type Outcome = true | null | Rejection;

export const refuse = (code: Rejection['code'], message: string, min?: Rejection['min']): Rejection =>
  min ? { code, message, min } : { code, message };

export const noRoom = (message = 'Not enough room in this run'): Rejection => refuse('noRoom', message);
export const notAllowed = (message: string): Rejection => refuse('notAllowed', message);

export function edit(config: Config, fn: (draft: Config, alloc: Alloc) => Outcome): EditResult {
  const draft = JSON.parse(JSON.stringify(config)) as Config;
  const alloc = makeAlloc(draft);
  const out = fn(draft, alloc);
  if (out === null) return { config, rejected: null };
  if (out !== true) return { config, rejected: out };
  normalizeConfig(draft, alloc);
  const rule = ruleViolation(draft);
  if (rule) return { config, rejected: rule };
  assertInvariants(draft);
  // Nothing actually changed (ids allocated along the way don't count).
  if (JSON.stringify({ ...draft, nextId: config.nextId }) === JSON.stringify(config)) return { config, rejected: null };
  return { config: draft, rejected: null };
}

export function findPiece(c: Config, id: string): { run: RunId; index: number; piece: RunPiece } | null {
  for (const run of runIds(c.shape)) {
    const index = c.runs[run]?.findIndex((p) => p.id === id) ?? -1;
    if (index >= 0) return { run, index, piece: c.runs[run]![index]! };
  }
  return null;
}
