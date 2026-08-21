'use client';

import { useQuery } from '@tanstack/react-query';
import { ovokFetch } from '@/lib/ovok-fetch';

export type ProjectSettingKey =
  | 'CONTENT_ENABLED'
  | 'MAILING_ENABLED'
  | 'PATIENT_INVITATION_ENABLED'
  | 'PATIENT_REGISTRATION_ENABLED'
  | 'PATIENT_LOGIN_ENABLED'
  | 'PRACTITIONER_INVITATION_ENABLED'
  | 'PRACTITIONER_REGISTRATION_ENABLED'
  | 'PRACTITIONER_LOGIN_ENABLED'
  | 'IOT_ENABLED';

export type ProjectSettingsMap = Record<ProjectSettingKey, boolean>;

type ProjectSettingsResponse = {
  settings?: Partial<ProjectSettingsMap>;
};

const emptySettings: ProjectSettingsMap = {
  CONTENT_ENABLED: false,
  MAILING_ENABLED: false,
  PATIENT_INVITATION_ENABLED: false,
  PATIENT_REGISTRATION_ENABLED: false,
  PATIENT_LOGIN_ENABLED: false,
  PRACTITIONER_INVITATION_ENABLED: false,
  PRACTITIONER_REGISTRATION_ENABLED: false,
  PRACTITIONER_LOGIN_ENABLED: false,
  IOT_ENABLED: false,
};

const hasBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const mergeSettings = (input: Partial<ProjectSettingsMap> | undefined): ProjectSettingsMap => ({
  CONTENT_ENABLED: hasBoolean(input?.CONTENT_ENABLED) ? input.CONTENT_ENABLED : emptySettings.CONTENT_ENABLED,
  MAILING_ENABLED: hasBoolean(input?.MAILING_ENABLED) ? input.MAILING_ENABLED : emptySettings.MAILING_ENABLED,
  PATIENT_INVITATION_ENABLED: hasBoolean(input?.PATIENT_INVITATION_ENABLED)
    ? input.PATIENT_INVITATION_ENABLED
    : emptySettings.PATIENT_INVITATION_ENABLED,
  PATIENT_REGISTRATION_ENABLED: hasBoolean(input?.PATIENT_REGISTRATION_ENABLED)
    ? input.PATIENT_REGISTRATION_ENABLED
    : emptySettings.PATIENT_REGISTRATION_ENABLED,
  PATIENT_LOGIN_ENABLED: hasBoolean(input?.PATIENT_LOGIN_ENABLED)
    ? input.PATIENT_LOGIN_ENABLED
    : emptySettings.PATIENT_LOGIN_ENABLED,
  PRACTITIONER_INVITATION_ENABLED: hasBoolean(input?.PRACTITIONER_INVITATION_ENABLED)
    ? input.PRACTITIONER_INVITATION_ENABLED
    : emptySettings.PRACTITIONER_INVITATION_ENABLED,
  PRACTITIONER_REGISTRATION_ENABLED: hasBoolean(input?.PRACTITIONER_REGISTRATION_ENABLED)
    ? input.PRACTITIONER_REGISTRATION_ENABLED
    : emptySettings.PRACTITIONER_REGISTRATION_ENABLED,
  PRACTITIONER_LOGIN_ENABLED: hasBoolean(input?.PRACTITIONER_LOGIN_ENABLED)
    ? input.PRACTITIONER_LOGIN_ENABLED
    : emptySettings.PRACTITIONER_LOGIN_ENABLED,
  IOT_ENABLED: hasBoolean(input?.IOT_ENABLED) ? input.IOT_ENABLED : emptySettings.IOT_ENABLED,
});

export const useProjectSettings = () =>
  useQuery({
    queryKey: ['takt', 'project-settings'],
    queryFn: async () => {
      const payload = await ovokFetch<ProjectSettingsResponse>('/v1/project/settings', {
        throwOnError: false,
      });
      return mergeSettings(payload?.settings);
    },
  });
