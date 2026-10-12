# runonmac

Run commands on GitHub-hosted macOS runners. Standard runners are free for
public repositories, while a private repository pays about ten times the Linux
rate for macOS minutes. This repo holds a single dispatch-only workflow
([`run.yml`](.github/workflows/run.yml)) and a CLI that drives it.

## Use

Requires `gh` (logged in, with write access to this repo), `git`, and `jq`.

```sh
./runonmac sw_vers                                   # one command
./runonmac -r macos-15-intel -- uname -m             # pick a runner image
./runonmac -f build.sh -a 'build/*.ipa'              # run a local script, fetch outputs
./runonmac -d ~/src/myapp -- swift test              # ship a local directory as the workspace
./runonmac -R owner/project --ref v2 -- make check   # check out another public repo
```

The CLI dispatches the workflow, follows the run, prints the command's output,
downloads any `-a` artifacts to `runonmac-out/<run id>/`, and exits non-zero if
the run failed. `./runonmac -h` lists every option.

You can also start a run without the CLI: **Actions → run → Run workflow**.

## Things to know

- **Everything is public**: the command text, the log, the artifacts, and any
  directory shipped with `-d`. The temporary branch that `-d` creates is deleted
  after the run, but the commit can still be fetched by its SHA. Don't send
  secrets or private code.
- **Only standard runner labels are free.** The `runner` input is a fixed list
  of standard labels, so `-large` and `-xlarge` runners, which are billed even
  on public repos, can't be selected by mistake. Add new images to that list as
  GitHub releases them.
- **Only people with write access can trigger runs.** The workflow has no
  `push` or `pull_request` trigger, and `workflow_dispatch` requires write access.
- **GitHub's terms limit what hosted runners may run.** They prohibit "any
  other activity unrelated to the production, testing, deployment, or
  publication of the software project" of the repository. Building and testing
  software is the intended use. Unrelated general-purpose compute risks having
  Actions disabled. See
  [GitHub Terms for Additional Products and Features](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#actions).
- Selecting a specific Xcode: prefix the command with
  `DEVELOPER_DIR=/Applications/Xcode_26.0.app/Contents/Developer`, using a
  version from the image's [software list](https://github.com/actions/runner-images#available-images).
