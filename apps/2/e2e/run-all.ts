import { execSync, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const e2eDir = join(import.meta.dirname),
  testFiles = readdirSync(e2eDir)
    .filter(f => f.endsWith('.test.ts'))
    .toSorted(),
  results: { file: string; passed: number; failed: number; flaky: number; time: number }[] = [],
  kill = () => {
    try {
      execSync('pkill -9 -f "next dev"', { stdio: 'ignore' })
    } catch {
      /* Pkill fails if no process found */
    }
  }

console.log(`\n🧪 Running ${testFiles.length} test files...\n`)

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

for (const file of testFiles) {
  kill()
  sleep(500)
  const start = Date.now(),
    result = spawnSync(
      'bun',
      ['with-env', 'playwright', 'test', `e2e/${file}`, '--reporter=dot', '--timeout=30000', '--retries=3'],
      {
        cwd: join(e2eDir, '..'),
        stdio: 'pipe',
        timeout: 300_000
      }
    ),
    output = result.stdout?.toString() ?? '',
    stderr = result.stderr?.toString() ?? '',
    combined = output + stderr,
    passMatch = combined.match(/(\d+) passed/u),
    failMatch = combined.match(/(\d+) failed/u),
    flakyMatch = combined.match(/(\d+) flaky/u),
    passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0,
    failed = failMatch?.[1] ? Number.parseInt(failMatch[1], 10) : 0,
    flaky = flakyMatch?.[1] ? Number.parseInt(flakyMatch[1], 10) : 0,
    time = (Date.now() - start) / 1000,
    status = failed > 0 ? '❌' : flaky > 0 ? '⚠️' : '✅'

  results.push({ failed, file, flaky, passed, time })
  console.log(
    `${status} ${file.padEnd(35)} ${passed} passed${flaky ? `, ${flaky} flaky` : ''}${failed ? `, ${failed} failed` : ''} (${time.toFixed(1)}s)`
  )
}

kill()

const total = results.reduce((a, r) => a + r.passed + r.flaky, 0),
  totalFailed = results.reduce((a, r) => a + r.failed, 0),
  totalFlaky = results.reduce((a, r) => a + r.flaky, 0),
  totalTime = results.reduce((a, r) => a + r.time, 0)

console.log(`\n${'─'.repeat(60)}`)
console.log(
  `Total: ${total} passed${totalFlaky ? `, ${totalFlaky} flaky` : ''}${totalFailed ? `, ${totalFailed} failed` : ''} (${totalTime.toFixed(1)}s)`
)

if (totalFailed > 0) {
  console.log('\n❌ Some tests failed:')
  for (const r of results.filter(x => x.failed > 0)) console.log(`   - ${r.file}: ${r.failed} failed`)
  process.exit(1)
}

console.log('\n✅ All tests passed!\n')
