// Shared RAG types for the grounded Jetlag Coach (US-R). Pure type declarations —
// imported by the pure retrieval/grounding units in lib/rag/ and the lib/ai/
// orchestrator. No runtime code, no I/O.

/** One retrievable passage: a single `##` section of a KB markdown doc. */
export interface Chunk {
  /** Deterministic, unique id, e.g. `${docId}#${index}`. */
  id: string;
  /** KB document the chunk came from, e.g. `eastward-vs-westward.md`. */
  docId: string;
  /** The section heading (without the leading `##`). */
  heading: string;
  /** The section body text. */
  text: string;
}

/** A precomputed embedding for a chunk; `id` matches the owning `Chunk.id`. */
export interface KbVector {
  id: string;
  vector: number[];
}

/**
 * A verifiable, external citation for a KB doc (authoritative org + URL). Sources
 * shown to the user are always these — never the internal doc filename — so a
 * citation means something the reader can actually check (US-R, AC-R3).
 */
export interface SourceRef {
  title: string;
  url: string;
}

/** A chunk with the similarity score retrieval assigned it. */
export interface ScoredChunk extends Chunk {
  score: number;
}

/** The refusal gate's verdict: answerable with supporting chunks, or refuse. */
export type Decision =
  | { answerable: true; chunks: ScoredChunk[] }
  | { answerable: false };
