# runonmac

Vision (Dave): "a generic public repo where I can run things on macOS runners
without incurring such a cost" — macOS minutes cost ~10x Linux on private repos
and are free on public ones. Privacy goal: keep run contents away from bots and
bad actors reading the public repo (GitHub itself seeing them is acceptable).

## Commands

- Run: `./runonmac [options] -- COMMAND` (`-h` for options)
- Lint: `actionlint && shellcheck runonmac`

## Invariants

- The repo stays public; that is the whole point (free standard runners).
- Nothing readable reaches the public surface. Commands, artifact patterns, and `-d`
  directories are age-encrypted to `runner.pub`. The log and returned files are
  encrypted to the user's local identity. The Run step writes output only to a file.
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
- `runner.pub` — runner's age recipient (private half is the `RUNONMAC_KEY` secret)
- `README.md` — usage, what stays public, key rotation, GitHub Actions terms
