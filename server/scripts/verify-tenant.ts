import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { createOvokFhirClient } from '../src/ovok.js';
import type { FhirResource } from '../src/domain/types.js';

type CapabilityStatement = FhirResource & {
  fhirVersion?: string;
  software?: { name?: string; version?: string };
  rest?: {
    resource?: {
      type?: string;
      conditionalCreate?: boolean;
    }[];
  }[];
};

const main = async (): Promise<void> => {
  const config = loadConfig();
  const fhir = createOvokFhirClient(config);

  const metadata = await fhir.read<CapabilityStatement>('/fhir/R4/metadata');
  const patients = await fhir.search('Patient', { _count: 1 });

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: config.OVOK_API_URL,
        tenantCode: config.OVOK_TENANT_CODE,
        fhirVersion: metadata.fhirVersion ?? null,
        software: metadata.software ?? null,
        patientSearchTotal: patients.total ?? patients.entry?.length ?? 0,
        communicationConditionalCreate:
          metadata.rest
            ?.flatMap((rest) => rest.resource ?? [])
            .find((resource) => resource.type === 'Communication')?.conditionalCreate ?? null,
      },
      null,
      2,
    ),
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
