import { TAKT_EXT } from './constants';
import type {
  FhirExtension,
  MedicationAdministrationResource,
  MedicationRequestResource,
} from './types';

/**
 * Server-side pill count (S-04): the MedicationRequest stores an anchor — the
 * count the user set/refilled and when. Remaining supply is derived from the
 * dose log, so there is no per-dose write, every device agrees, and undoing a
 * dose (DELETE of the administration) restores the count by itself.
 */
export type SupplyAnchor = { count: number; at: string };

/** Units one taken dose removes; mirrors deductSupply (per-intake amount, at least 1). */
export const unitsPerDose = (dosageQuantity?: number): number =>
  Math.max(1, Math.round(dosageQuantity ?? 1));

export const supplyAnchorExtension = (count: number, at: string): FhirExtension => ({
  url: TAKT_EXT.supplyAnchor,
  extension: [
    { url: 'count', valueDecimal: Math.max(0, Math.round(count)) },
    { url: 'at', valueDateTime: at },
  ],
});

export const readSupplyAnchor = (
  request: Pick<MedicationRequestResource, 'extension'>,
): SupplyAnchor | undefined => {
  const ext = request.extension?.find((x) => x.url === TAKT_EXT.supplyAnchor);
  const count = ext?.extension?.find((x) => x.url === 'count')?.valueDecimal;
  const at = ext?.extension?.find((x) => x.url === 'at')?.valueDateTime;
  if (typeof count !== 'number' || !Number.isFinite(count) || !at || Number.isNaN(Date.parse(at)))
    return undefined;
  return { count, at };
};

/** Replace (or drop, when count is undefined) the anchor in an extension list. */
export const withSupplyAnchor = (
  extensions: FhirExtension[] | undefined,
  count: number | undefined,
  at: string,
): FhirExtension[] => [
  ...(extensions ?? []).filter((x) => x.url !== TAKT_EXT.supplyAnchor),
  ...(typeof count === 'number' && Number.isFinite(count)
    ? [supplyAnchorExtension(count, at)]
    : []),
];

/**
 * anchor.count minus every *completed* dose of this plan taken after the anchor.
 * Doses before the anchor came out of the previous pack; skipped/missed doses use nothing.
 */
export const remainingSupply = (
  anchor: SupplyAnchor,
  administrations: Pick<
    MedicationAdministrationResource,
    'status' | 'request' | 'effectiveDateTime'
  >[],
  requestRef: string,
  dosageQuantity?: number,
): number => {
  const from = Date.parse(anchor.at);
  const per = unitsPerDose(dosageQuantity);
  const used = administrations.filter(
    (a) =>
      a.status === 'completed' &&
      a.request?.reference === requestRef &&
      Boolean(a.effectiveDateTime) &&
      Date.parse(a.effectiveDateTime ?? '') > from,
  ).length;
  return Math.max(0, Math.round(anchor.count) - used * per);
};
