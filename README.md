# @toktokhan-dev/tok-builder-cli

pj-platform CLI for outsourcing build orchestration. Provides the `pj` command.

Internal tool for the toktokhan-dev organization. Used by build-plan implementers to
report progress, sync artifacts, and resume work after Claude session restarts.

## Install

```bash
npm install -g @toktokhan-dev/tok-builder-cli
```

(Requires authenticated access to the toktokhan-dev GitHub Packages registry.)

## Commands

See `pj --help` for the full list — `pj login`, `pj task`, `pj plan`, `pj run`,
`pj phase`, `pj resume`, `pj init`.

## Bootstrap

Implementers receive a `pjp_apt_*` token from the platform and run:

```bash
curl -fsSL https://raw.githubusercontent.com/toktokhan-dev/tok-builder-cli/main/install.sh | sh -s <token>
```
