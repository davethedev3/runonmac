# runonmac

Vision (Dave): "a generic public repo where I can run things on macOS runners
without incurring such a cost" — macOS minutes cost ~10x Linux on private repos
and are free on public ones.

## Commands

- Run: `./runonmac [options] -- COMMAND` (`-h` for options)
- Lint: `actionlint && shellcheck runonmac`

## Invariants

- The repo stays public; that is the whole point (free standard runners).
- `.github/workflows/run.yml` is `workflow_dispatch` only. Any `push`/`pull_request` trigger would let
  branch pushes (including `runonmac -d` snapshot branches) or fork PRs run code.
- The `runner` input is a `choice` of standard labels. `-large`/`-xlarge` labels bill
  even on public repos, so they stay off the list.
- The command reaches the shell through `env: COMMAND`, never `${{ }}` inside `run:`,
  so expression expansion cannot rewrite the script.

## Map

- `.github/workflows/run.yml` — the workflow
- `runonmac` — CLI: dispatch, watch, print the Run step's log, download artifacts
- `README.md` — usage and caveats (public logs, GitHub Actions terms)
