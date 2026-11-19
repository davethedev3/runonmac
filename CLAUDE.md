# runonmac

Vision (Dave): "a generic public repo where I can run things on macOS runners
without incurring such a cost" — macOS minutes cost ~10x Linux on private repos
and are free on public ones. Privacy goal: keep run contents away from bots and
bad actors reading the public repo (GitHub itself seeing them is acceptable).

## Commands

- Run: `./runonmac [options] -- COMMAND` (`-h` for options)
- Lint: `actionlint && shellcheck runonmac`
- Test a workflow change: push a branch, then `RUNONMAC_WORKFLOW_REF=<branch> ./runonmac ...`

## Invariants

- The repo stays public; that is the whole point (free standard runners).
- Nothing readable reaches the public surface. Commands, artifact patterns, `-d`
  directories and the live-output URL are age-encrypted to `runner.pub`. The log
  (live and sealed) and returned files are encrypted to the user's local identity.
  The Run step writes output only to a file, and its live-output sender runs with
  stdin, stdout and stderr on /dev/null, because curl errors would print the tunnel host.
- The live stream is best-effort: a missing or dead tunnel must never fail or hang a
  run. The sealed log stays the source of truth for `--fetch` and returned files.
- CLI lines on stderr start with `runonmac: `, and every exit after dispatch ends with
  `runonmac: done: …` (SIGKILL excepted). Monitor recipes depend on this.
- Only the Decrypt step gets `secrets.RUNONMAC_KEY`, and it deletes the key file
  before the command runs.
- `.github/workflows/run.yml` is `workflow_dispatch` only. Any `push`/`pull_request` trigger would let
  branch pushes (including `runonmac -d` snapshot branches) or fork PRs run code.
- The `runner` input is a `choice` of standard labels. `-large`/`-xlarge` labels bill
  even on public repos, so they stay off the list.
- Inputs reach the shell through `env:`, never `${{ }}` inside `run:`, so expression
  expansion cannot rewrite the script.
- `AGE_VERSION` and the two darwin tarball SHA-256s in run.yml change together.

## Map

- `.github/workflows/run.yml` — the workflow
- `runonmac` — CLI: encrypt, dispatch, watch, decrypt the log and files
- `listen.ts` — live-output listener (bun): quick tunnel, decrypts and prints chunks
- `runner.pub` — runner's age recipient (private half is the `RUNONMAC_KEY` secret)
- `README.md` — usage, what stays public, key rotation, GitHub Actions terms
