/**
 * Field-mapping types.
 *
 * The deterministic matcher consumes a list of source column names (the
 * customer's CSV) and a target schema (your known fields with optional
 * synonym aliases) and returns a mapping with provenance.
 */

export interface TargetField {
  /** Canonical field name in your schema. */
  name: string;
  /**
   * Extra synonyms specific to this field that the global synonym dictionary
   * doesn't cover. Optional.
   */
  aliases?: string[];
  /** Free-text description, surfaced in AI prompts. Optional. */
  description?: string;
}

export interface FieldMapInput {
  sourceColumns: string[];
  targetSchema: TargetField[];
}

export type MatchMethod = "exact" | "synonym" | "token" | "edit" | "ai";

export interface FieldMapping {
  source: string;
  target: string;
  score: number;
  method: MatchMethod;
}

export interface FieldMapResult {
  mappings: FieldMapping[];
  unmappedSource: string[];
  unmappedTarget: string[];
}
