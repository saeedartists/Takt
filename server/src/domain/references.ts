export type ParsedReference = {
  type: string;
  id: string;
};

/**
 * Accepts relative references (`Patient/abc`), absolute REST references
 * (`https://host/fhir/R4/Patient/abc`), and versioned references
 * (`Patient/abc/_history/1`). URN references are intentionally unsupported.
 */
export const parseReference = (reference?: string): ParsedReference | undefined => {
  if (!reference) return undefined;
  const match = /([A-Za-z]+)\/([A-Za-z0-9\-.]{1,64})(?:\/_history\/[^/?#]+)?(?:[?#].*)?$/.exec(
    reference.trim(),
  );
  if (!match?.[1] || !match[2]) return undefined;
  return { type: match[1], id: match[2] };
};

export const referenceId = (reference?: string): string | undefined => parseReference(reference)?.id;

export const normalizeReference = (reference?: string): string | undefined => {
  const parsed = parseReference(reference);
  return parsed ? `${parsed.type}/${parsed.id}` : undefined;
};

export const sameReference = (left?: string, right?: string): boolean => {
  const a = normalizeReference(left);
  const b = normalizeReference(right);
  return Boolean(a && b && a === b);
};

export const referenceMatches = (reference: string | undefined, type: string, id: string): boolean => {
  const parsed = parseReference(reference);
  return parsed?.type === type && parsed.id === id;
};
