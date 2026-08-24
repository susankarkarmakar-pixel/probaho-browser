import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const releaseDir = new URL('../release/', import.meta.url);
const outputPath = process.argv[2] || 'release/SHA256SUMS.txt';
const outputUrl = new URL(`../${outputPath.replace(/^release\//, 'release/')}`, import.meta.url);
const releasePath = fileURLToPath(releaseDir);
const outputFilePath = fileURLToPath(outputUrl);

if (!existsSync(releasePath)) {
  throw new Error(`Release directory does not exist: ${releasePath}`);
}

const files = readdirSync(releasePath)
  .filter((name) => !name.startsWith('SHA256SUMS-') && !name.endsWith('.blockmap') && !name.endsWith('.yml') && !name.endsWith('.yaml') && statSync(join(releasePath, name)).isFile())
  .map((name) => {
    const path = join(releasePath, name);
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    return `${digest}  ${relative(releasePath, path)}`;
  })
  .sort();

if (files.length === 0) throw new Error('No release files found for checksum generation');
writeFileSync(outputFilePath, `${files.join('\n')}\n`, 'utf8');
console.log(`Wrote ${files.length} checksums to ${outputPath}`);
