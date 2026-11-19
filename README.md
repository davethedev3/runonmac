# runonmac

Run commands on GitHub-hosted macOS runners. Standard runners are free for
public repositories, while a private repository pays about ten times the Linux
rate for macOS minutes. Because this repo is public, everything that would be
readable is encrypted with [age](https://github.com/FiloSottile/age).

## Use

Requires `gh` (logged in, with write access to this repo), `git`, `jq`, `age`
and `age-keygen`. Live output also needs `bun` and `cloudflared`; without
them the output prints when the run ends.

```sh
./runonmac sw_vers                                   # one command
./runonmac -r macos-15-intel -- uname -m             # pick a runner image
./runonmac -f build.sh -a 'build/*.ipa'              # run a local script, fetch outputs
./runonmac -d ~/src/myapp -- swift test              # ship a local directory as the workspace
./runonmac -R owner/project --ref v2 -- make check   # check out another public repo
```

The CLI dispatches the workflow, prints the command's output as it runs,
extracts any `-a` files into `runonmac-out/<run id>/`, and exits non-zero if
the run failed. If the CLI is interrupted, the run continues on GitHub, and
`./runonmac --fetch RUN_ID` (the ID is printed at dispatch) waits for it and
collects the output. `-a` takes files, directories (returned whole) or plain
globs like `build/*.ipa`; the runners' bash 3.2 has no recursive `**`.
`./runonmac -h` lists every option. Runs can't be started from
the web UI, because the workflow accepts only encrypted input.

## Live output

The CLI starts `listen.ts` (with bun), which serves localhost through a
cloudflared [quick tunnel](https://try.cloudflare.com)
and makes up a random token. The CLI dispatches only once the tunnel answers,
which takes a few seconds, because a runner that looks up a quick-tunnel name
before it exists caches the miss for 60 seconds. The tunnel URL and token
travel to the runner encrypted, like the command. While the command runs, a sender in the Run step
reads new log bytes about once a second and encrypts them to your identity. It
then POSTs them to the tunnel, and the listener decrypts and prints them. Each
reply carries the number of bytes printed so far, so a lost or repeated POST
is resent or skipped rather than printed twice. When the run ends, the CLI
prints whatever the stream missed from the sealed log, so the output is always
complete and the same as `--fetch` would give.

The stream is best-effort. A tunnel that doesn't come up, a dead tunnel or a
killed CLI never fails or holds up the run; at most it adds 15 seconds at the
end. GitHub's own job log can't be read until the job ends, so there is no
channel for live output inside GitHub. `--no-stream` turns it off.

stdout carries only the command's output. Every CLI line goes to stderr and
starts with `runonmac: `: the dispatched run's ID and URL, each state change
(`queued`, `in_progress`, `streaming`), and on every exit once a run exists, a
final `runonmac: done: CONCLUSION, exit N, run ID`. A watcher can merge the two
streams and filter on that prefix.

## Encryption

| Data | Encrypted to | Decrypted by |
|---|---|---|
| Command, `-a` patterns, `-d` directory, live-output URL | `runner.pub` | the runner, using the `RUNONMAC_KEY` repo secret |
| Command output (stdout and stderr), live or sealed, and `-a` files | your identity, `~/.config/runonmac/identity` (created on first use; `RUNONMAC_IDENTITY` overrides) | the CLI |

The runner deletes its key file before running the command, and the command's
output goes only to the encrypted log, so the public step log shows just the
exit code.

**Still public:** that a run happened and when, its duration, the runner
image, the exit status, the `--repo`/`--ref` values, ciphertext sizes, and
whether `-a` was used. Whether live output was used is public too (the
`stream` input is empty or not). Cloudflare, though not the public, also sees
the live ciphertext, its timing and its chunk sizes.

**Rotating the runner key** (for example, if the secret may have leaked):

```sh
age-keygen -o key && age-keygen -y key > runner.pub
gh secret set RUNONMAC_KEY < key && rm key
git commit -am "Rotate runner key" && git push
```

Ciphertext already published stays public. Inputs encrypted to an old runner
key can be read by anyone who gets that key, and output can be read by anyone
who gets your identity file. Copy that file to use the CLI on another machine.

## Things to know

- **Only standard runner labels are free.** The `runner` input is a fixed list
  of standard labels, so `-large` and `-xlarge` runners, which are billed even
  on public repos, can't be selected by mistake. Add new images to that list as
  GitHub releases them.
- **Only people with write access can trigger runs**, and they're the only
  ones who can use the secret. The workflow has no `push` or `pull_request`
  trigger, and secrets aren't passed to workflows triggered from forks.
- **GitHub's terms limit what hosted runners may run.** They prohibit "any
  other activity unrelated to the production, testing, deployment, or
  publication of the software project" of the repository. Building and testing
  software is the intended use. Unrelated general-purpose compute risks having
  Actions disabled. See
  [GitHub Terms for Additional Products and Features](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#actions).
- **Timeouts:** a command that hits its `-t` timeout is stopped, and its
  output up to that point is still returned.
- **Selecting a specific Xcode:** prefix the command with
  `DEVELOPER_DIR=/Applications/Xcode_26.0.app/Contents/Developer`, using a
  version from the image's [software list](https://github.com/actions/runner-images#available-images).
