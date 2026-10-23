import { spawnSync } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { compile } from 'json-schema-to-typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const frontend = new URL('../', import.meta.url)
const check = process.argv.includes('--check')
const source = JSON.parse(await readFile(new URL('./intent-source.json', import.meta.url), 'utf8'))
const run = spawnSync('uv', ['run', '--project', root, '--frozen', '--no-dev', 'python',
  fileURLToPath(new URL('./export_intent_contracts.py', import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
if (run.status !== 0) { process.stderr.write(run.stderr || 'Intent export failed'); process.exit(1) }
const data = JSON.parse(run.stdout)
const bannerComment = `/* Generated from intent backend ${source.intentRef}. Do not edit. */`
const outputs = new Map()
for (const kind of ['requests', 'responses']) {
  const schema = data[kind]
  outputs.set(`src/contracts/intent/${kind}.schema.json`, `${JSON.stringify(schema, null, 2)}\n`)
  // Model schemas have named definitions; expose each without an invented wrapper.
  const properties = Object.fromEntries(Object.keys(schema.$defs).map(name => [name, { $ref: `#/$defs/${name}` }]))
  outputs.set(`src/contracts/intent/${kind}.ts`, await compile({ ...schema, type: 'object', properties,
    additionalProperties: false, required: Object.keys(properties) }, 'IntentContracts',
  { bannerComment, unknownAny: true, style: { singleQuote: true } }))
}
let fixtures = `${bannerComment}\nimport type { CreatedIntent, IntentView } from '../../contracts/intent/responses'\nimport type { JourneyRecommendations } from '../../contracts'\n`
for (const [name, value] of Object.entries(data.fixtures)) fixtures += `\nexport const ${name}: ${name === 'createdIntentFixture' ? 'CreatedIntent' : name === 'intentJourneyFixture' ? 'JourneyRecommendations' : 'IntentView'} = ${JSON.stringify(value, null, 2)}\n`
outputs.set('src/test/fixtures/intents.ts', fixtures)
let drift = false
for (const [name, contents] of outputs) {
  const target = new URL(name, frontend)
  if (await readFile(target, 'utf8').catch(() => null) === contents) continue
  if (check) { process.stderr.write(`Intent contract drift: ${name}\n`); drift = true }
  else { await mkdir(new URL('./', target), { recursive: true }); await writeFile(target, contents) }
}
if (drift) process.exit(1)
console.log(check ? 'Pinned intent contracts and fixtures match.' : 'Pinned intent contracts generated.')
