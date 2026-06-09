import { run as behaviorTests } from "./flow_behavior.test.mjs";
import { run as csvPipelineTests } from "./csv_pipeline.test.mjs";
import { run as docsAndSafetyTests } from "./docs_and_safety.test.mjs";

export async function runAll() {
  let total = 0;
  total += behaviorTests();
  total += csvPipelineTests();
  total += docsAndSafetyTests();
  console.log(`\n${total === 0 ? "ALL PASS" : total + " CHECK(S) FAILED"}`);
  return total === 0 ? 0 : 1;
}

import { fileURLToPath } from 'url';
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  runAll().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
}
