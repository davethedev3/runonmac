// Live log receiver for runonmac, run by the CLI with bun:
//   bun listen.ts IDENTITY DIR PARENT_PID
// Serves 127.0.0.1 through a cloudflared quick tunnel and writes DIR/url
// (https://<host>.trycloudflare.com/<token>) once the tunnel is up. The runner
// POSTs to <url>/<offset> a binary age file, encrypted to IDENTITY's recipient,
// holding the log bytes from <offset>. Bytes not yet printed go to stdout
// raw, in order, and DIR/offset records how many have been printed. Every
// response body is that count, so the runner resends from wherever this
// side actually is. Exits on SIGTERM or SIGINT, or when PARENT_PID is gone,
// and stops cloudflared on the way out.
import { writeFileSync, renameSync, writeSync } from 'node:fs'

const [identity, dir, parentArg] = process.argv.slice(2)
if (!identity || !dir || !parentArg) {
  console.error('usage: bun listen.ts IDENTITY DIR PARENT_PID')
  process.exit(2)
}
const parent = Number(parentArg)
const token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex')

let printed = 0
let announced = false
let closing = false

function publish(name: string, text: string) {
  writeFileSync(`${dir}/${name}.tmp`, text)
  renameSync(`${dir}/${name}.tmp`, `${dir}/${name}`)
}

function emit(bytes: Uint8Array) {
  for (let at = 0; at < bytes.length; ) at += writeSync(1, bytes, at)
}

async function decrypt(body: ArrayBuffer): Promise<Uint8Array | null> {
  const age = Bun.spawn(['age', '-d', '-i', identity], { stdin: new Uint8Array(body), stdout: 'pipe', stderr: 'ignore' })
  const [out, code] = await Promise.all([new Response(age.stdout).bytes(), age.exited])
  return code === 0 ? out : null
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  maxRequestBodySize: 16 * 1024 * 1024,
  async fetch(req) {
    const m = new URL(req.url).pathname.match(/^\/([0-9a-f]+)\/(\d+)$/)
    if (req.method !== 'POST' || !m || m[1] !== token) return new Response('', { status: 404 })
    const offset = Number(m[2])
    const plain = await decrypt(await req.arrayBuffer())
    if (closing) return new Response(String(printed), { status: 503 })
    if (plain === null) return new Response(String(printed), { status: 400 })
    if (!announced) {
      announced = true
      console.error('runonmac: streaming')
    }
    // Synchronous from here to the response: a signal handler can't run in
    // between, so stdout and DIR/offset always agree.
    const end = offset + plain.length
    if (offset <= printed && end > printed) {
      emit(plain.subarray(printed - offset))
      printed = end
      publish('offset', String(printed))
    }
    return new Response(String(printed))
  },
})

// A config file holding only the URL keeps any system named tunnel's
// config (/etc/cloudflared/config.yml and its ingress rules) out of this one.
writeFileSync(`${dir}/cloudflared.yml`, '')
const tunnel = Bun.spawn(
  ['cloudflared', '--config', `${dir}/cloudflared.yml`, 'tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${server.port}`],
  { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' },
)

// Nothing prints once closing is set, so DIR/offset is final; exit only after
// cloudflared has, so no process outlives the CLI.
async function quit(code: number) {
  if (closing) return
  closing = true
  server.stop(true)
  tunnel.kill()
  const force = setTimeout(() => tunnel.kill('SIGKILL'), 3000)
  await tunnel.exited
  clearTimeout(force)
  process.exit(code)
}
process.on('SIGTERM', () => quit(0))
process.on('SIGINT', () => quit(0))
setInterval(() => {
  try {
    process.kill(parent, 0)
  } catch {
    quit(0)
  }
}, 2000)
tunnel.exited.then(() => quit(1))

// cloudflared prints the quick tunnel's hostname on stderr; keep its log for diagnosis.
const log = Bun.file(`${dir}/cloudflared.log`).writer()
let seen: string | null = ''
for await (const chunk of tunnel.stderr) {
  log.write(chunk)
  log.flush()
  if (seen === null) continue
  seen += new TextDecoder().decode(chunk)
  // Not api.trycloudflare.com, which appears in cloudflared's errors.
  const host = seen.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/)
  if (host) {
    publish('url', `${host[0]}/${token}`)
    seen = null
  }
}
