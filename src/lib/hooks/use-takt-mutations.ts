'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ovokFetch } from '@/lib/ovok-fetch';
import { PRIMARY_PATIENT_STORAGE_KEY, TAKT_CONSENT_VERSION, TAKT_EXT } from '@/lib/takt/constants';
import { normalizeWeekdayCodes, sortTimes, toTimeOfDay, WEEKDAY_ORDER, WEEKDAYS_ONLY } from '@/lib/takt/time';
import type {
  ConsentResource,
  MedicationAdministrationResource,
  MedicationCadence,
  MedicationRequestResource,
  MedicationResource,
  WeekdayCode,
} from '@/lib/takt/types';

type PlanInput = {
  patientRef: string;
  name: string;
  form: string;
  strength: string;
  cadence: MedicationCadence;
  dayOfWeek?: WeekdayCode[];
  times: string[];
  supplyCount?: number;
};

type UpdatePlanInput = PlanInput & {
  request: MedicationRequestResource;
  medication: MedicationResource;
  status: 'active' | 'on-hold' | 'stopped';
};

const persistPrimaryPatientId = async (patientRef: string): Promise<void> => {
  const id = patientRef.split('/')[1];
  if (id) {
    await AsyncStorage.setItem(PRIMARY_PATIENT_STORAGE_KEY, id);
  }
};

const resolveDays = (cadence: MedicationCadence, dayOfWeek?: WeekdayCode[]): WeekdayCode[] => {
  if (cadence === 'daily') return WEEKDAY_ORDER;
  if (cadence === 'weekdays') return WEEKDAYS_ONLY;
  const normalized = normalizeWeekdayCodes(dayOfWeek ?? []);
  return normalized.length > 0 ? normalized : WEEKDAYS_ONLY;
};

const cadenceRepeat = (
  cadence: MedicationCadence,
  times: string[],
  dayOfWeek?: WeekdayCode[],
): {
  frequency: number;
  period: number;
  periodUnit: 'd';
  dayOfWeek: WeekdayCode[];
  timeOfDay: string[];
} => ({
  frequency: 1,
  period: 1,
  periodUnit: 'd',
  dayOfWeek: resolveDays(cadence, dayOfWeek),
  timeOfDay: sortTimes(times).map(toTimeOfDay),
});

export const useCreateMedicationPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanInput) => {
      const medication = await ovokFetch<MedicationResource>('/fhir/R4/Medication', {
        method: 'POST',
        body: JSON.stringify({
          resourceType: 'Medication',
          status: 'active',
          code: { text: input.name.trim() },
          form: { text: input.form.trim() || 'Tablet' },
          extension: [
            {
              url: TAKT_EXT.strength,
              valueString: input.strength.trim(),
            },
          ],
        }),
      });

      const medicationRequest = await ovokFetch<MedicationRequestResource>('/fhir/R4/MedicationRequest', {
        method: 'POST',
        body: JSON.stringify({
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          authoredOn: new Date().toISOString().slice(0, 10),
          subject: { reference: input.patientRef },
          medicationReference: { reference: `Medication/${medication.id}` },
          dosageInstruction: [
            {
              timing: {
                repeat: cadenceRepeat(input.cadence, input.times, input.dayOfWeek),
              },
            },
          ],
          ...(typeof input.supplyCount === 'number'
            ? {
                dispenseRequest: {
                  quantity: {
                    value: input.supplyCount,
                    unit: 'tablets',
                  },
                },
              }
            : {}),
        }),
      });

      return { medication, medicationRequest };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['takt', 'Medication'] });
      void qc.invalidateQueries({ queryKey: ['takt', 'MedicationRequest'] });
    },
  });
};

export const useUpdateMedicationPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePlanInput) => {
      const medication = await ovokFetch<MedicationResource>(`/fhir/R4/Medication/${input.medication.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...input.medication,
          code: { text: input.name.trim() },
          form: { text: input.form.trim() || 'Tablet' },
          extension: [
            {
              url: TAKT_EXT.strength,
              valueString: input.strength.trim(),
            },
          ],
        }),
      });

      const medicationRequest = await ovokFetch<MedicationRequestResource>(
        `/fhir/R4/MedicationRequest/${input.request.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            ...input.request,
            status: input.status,
            dosageInstruction: [
              {
                timing: {
                  repeat: cadenceRepeat(input.cadence, input.times, input.dayOfWeek),
                },
              },
            ],
            ...(typeof input.supplyCount === 'number'
              ? {
                  dispenseRequest: {
                    quantity: {
                      value: input.supplyCount,
                      unit: 'tablets',
                    },
                  },
                }
              : {
                  dispenseRequest: undefined,
                }),
          }),
        },
      );

      return { medication, medicationRequest };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['takt', 'Medication'] });
      void qc.invalidateQueries({ queryKey: ['takt', 'MedicationRequest'] });
      void qc.invalidateQueries({ queryKey: ['takt', 'MedicationAdministration'] });
    },
  });
};

export const useRecordDose = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      patientRef: string;
      medicationRef?: string;
      requestRef: string;
      scheduledAt: Date;
      action: 'taken' | 'skipped' | 'missed';
    }) => {
      const body: Omit<MedicationAdministrationResource, 'id'> = {
        resourceType: 'MedicationAdministration',
        status: input.action === 'taken' ? 'completed' : 'not-done',
        subject: { reference: input.patientRef },
        request: { reference: input.requestRef },
        medicationReference: input.medicationRef ? { reference: input.medicationRef } : undefined,
        effectiveDateTime: new Date().toISOString(),
        extension: [
          {
            url: TAKT_EXT.scheduledTime,
            valueDateTime: input.scheduledAt.toISOString(),
          },
        ],
        ...(input.action !== 'taken'
          ? {
              statusReason: [
                {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/reason-medication-not-given',
                      code: input.action === 'missed' ? 'not-available' : 'patient-refusal',
                      display: input.action,
                    },
                  ],
                },
              ],
            }
          : {}),
      };

      return ovokFetch<MedicationAdministrationResource>('/fhir/R4/MedicationAdministration', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['takt', 'MedicationAdministration'] });
    },
  });
};

export const useUndoDose = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      await ovokFetch(`/fhir/R4/MedicationAdministration/${eventId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['takt', 'MedicationAdministration'] });
    },
  });
};

export const useEnsurePatient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const patient = await ovokFetch<{ id: string; resourceType: 'Patient' }>('/fhir/R4/Patient', {
        method: 'POST',
        body: JSON.stringify({
          resourceType: 'Patient',
          name: [{ given: ['Takt'], family: 'User' }],
          gender: 'unknown',
        }),
      });
      await AsyncStorage.setItem(PRIMARY_PATIENT_STORAGE_KEY, patient.id);
      return patient;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['takt', 'patient'] });
    },
  });
};

const writeConsent = async (patientRef: string, status: 'active' | 'inactive') => {
  const body: ConsentResource = {
    resourceType: 'Consent',
    status,
    patient: { reference: patientRef },
    dateTime: new Date().toISOString(),
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://loinc.org',
            code: '59284-0',
            display: 'Patient Consent',
          },
        ],
      },
    ],
    policyRule: {
      text: TAKT_CONSENT_VERSION,
    },
  };

  await persistPrimaryPatientId(patientRef);
  return ovokFetch('/fhir/R4/Consent', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const useRecordConsent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patientRef: string) => writeConsent(patientRef, 'active'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['takt', 'Consent'] });
    },
  });
};

export const useWithdrawConsent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patientRef: string) => writeConsent(patientRef, 'inactive'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['takt', 'Consent'] });
    },
  });
};
