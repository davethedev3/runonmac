# runonmac

Run commands on GitHub-hosted macOS runners. Standard runners are free for
public repositories, while a private repository pays about ten times the Linux
rate for macOS minutes. Because this repo is public, everything that would be
readable is encrypted with [age](https://github.com/FiloSottile/age).

## Use

Requires `gh` (logged in, with write access to this repo), `git`, `jq`, `age`
and `age-keygen`.

```sh
./runonmac sw_vers                                   # one command
./runonmac -r macos-15-intel -- uname -m             # pick a runner image
./runonmac -f build.sh -a 'build/*.ipa'              # run a local script, fetch outputs
./runonmac -d ~/src/myapp -- swift test              # ship a local directory as the workspace
./runonmac -R owner/project --ref v2 -- make check   # check out another public repo
```

The CLI dispatches the workflow, follows the run, prints the command's output,
extracts any `-a` files into `runonmac-out/<run id>/`, and exits non-zero if
the run failed. If the CLI is interrupted, the run continues on GitHub, and
`./runonmac --fetch RUN_ID` (the ID is printed at dispatch) waits for it and
collects the output. `-a` takes files, directories (returned whole) or plain
globs like `build/*.ipa`; the runners' bash 3.2 has no recursive `**`.
`./runonmac -h` lists every option. Runs can't be started from
the web UI, because the workflow accepts only encrypted input.

## Encryption

| Data | Encrypted to | Decrypted by |
|---|---|---|
| Command, `-a` patterns, `-d` directory | `runner.pub` | the runner, using the `RUNONMAC_KEY` repo secret |
| Command output (stdout and stderr) and `-a` files | your identity, `~/.config/runonmac/identity` (created on first use; `RUNONMAC_IDENTITY` overrides) | the CLI |

The runner deletes its key file before running the command, and the command's
output goes only to the encrypted log, so the public step log shows just the
exit code.

**Still public:** that a run happened and when, its duration, the runner
image, the exit status, the `--repo`/`--ref` values, ciphertext sizes, and
whether `-a` was used.

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
