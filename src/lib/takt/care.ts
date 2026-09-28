'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/*
 * Care team & appointments — kept on this device only (like reminder
 * preferences), never sent to the health platform.
 */

export type CareRole = 'doctor' | 'specialist' | 'pharmacy' | 'nurse' | 'family' | 'other';
export const CARE_ROLES: CareRole[] = ['doctor', 'specialist', 'pharmacy', 'nurse', 'family', 'other'];

export type CareContact = {
  id: string;
  name: string;
  role: CareRole;
  phone?: string;
  email?: string;
  note?: string;
};

export type CareAppointment = {
  id: string;
  title: string;
  contactId?: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time?: string;
  place?: string;
  note?: string;
};

type CareData = { contacts: CareContact[]; appointments: CareAppointment[] };

export const CARE_STORAGE_KEY = 'takt:care:v1';
const QUERY_KEY = ['takt', 'care'] as const;
const EMPTY: CareData = { contacts: [], appointments: [] };

const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const readCare = async (): Promise<CareData> => {
  const raw = await AsyncStorage.getItem(CARE_STORAGE_KEY);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<CareData>;
    return {
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
    };
  } catch {
    return EMPTY;
  }
};

const writeCare = async (data: CareData): Promise<CareData> => {
  await AsyncStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(data));
  return data;
};

/** Sort key: date then time; an untimed visit sorts to the start of its day. */
const whenKey = (a: CareAppointment): string => `${a.date}T${a.time ?? '00:00'}`;

/** Local Date for an appointment (noon when untimed, so day maths never slips across midnight). */
export const appointmentDate = (a: CareAppointment): Date => new Date(`${a.date}T${a.time ?? '12:00'}:00`);

/** Whole calendar days from `now` to the appointment's day (0 = today). */
export const daysUntil = (a: CareAppointment, now = new Date()): number => {
  const day = new Date(`${a.date}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
};

/** Upcoming = today or later, soonest first; past = before today, newest first. */
export const splitAppointments = (list: CareAppointment[], now = new Date()) => {
  const upcoming = list.filter((a) => daysUntil(a, now) >= 0).sort((x, y) => whenKey(x).localeCompare(whenKey(y)));
  const past = list.filter((a) => daysUntil(a, now) < 0).sort((x, y) => whenKey(y).localeCompare(whenKey(x)));
  return { upcoming, past };
};

export const useCare = () => {
  const qc = useQueryClient();
  const query = useQuery<CareData>({ queryKey: QUERY_KEY, queryFn: readCare });

  const mutation = useMutation({
    mutationFn: async (update: (data: CareData) => CareData) => writeCare(update(await readCare())),
    onSuccess: (next) => qc.setQueryData(QUERY_KEY, next),
  });

  const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

  return {
    ...query,
    contacts: query.data?.contacts ?? [],
    appointments: query.data?.appointments ?? [],
    saveContact: (contact: Omit<CareContact, 'id'> & { id?: string }) =>
      mutation.mutateAsync((d) => ({ ...d, contacts: upsert(d.contacts, { ...contact, id: contact.id ?? newId() }) })),
    /** Removing a contact keeps its appointments; they just lose the "with whom". */
    deleteContact: (id: string) =>
      mutation.mutateAsync((d) => ({
        contacts: d.contacts.filter((x) => x.id !== id),
        appointments: d.appointments.map((a) => (a.contactId === id ? { ...a, contactId: undefined } : a)),
      })),
    saveAppointment: (appt: Omit<CareAppointment, 'id'> & { id?: string }) =>
      mutation.mutateAsync((d) => ({ ...d, appointments: upsert(d.appointments, { ...appt, id: appt.id ?? newId() }) })),
    deleteAppointment: (id: string) =>
      mutation.mutateAsync((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== id) })),
    isSaving: mutation.isPending,
  };
};
