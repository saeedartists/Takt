import { runAdherenceFixtureSuite } from '../src/lib/takt/fixtures/adherence-fixtures';

const suite = runAdherenceFixtureSuite();

for (const result of suite.results) {
  const mark = result.passed ? 'PASS' : 'FAIL';
  // eslint-disable-next-line no-console
  console.log(`${mark}  ${result.id}  ${result.title}`);
  // eslint-disable-next-line no-console
  console.log(`      ${result.details}`);
}

if (!suite.passed) {
  process.exitCode = 1;
}
