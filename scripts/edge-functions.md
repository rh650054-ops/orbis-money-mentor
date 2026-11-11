# Edge Functions: compare with production and publish

Manual workflow `.github/workflows/edge-functions.yml` (Actions → edge-functions → Run workflow).
It exists because functions used to be published by pasting files through a connector, and nothing
proved that production ran what this repository says (audit 10/11/2026, F-05).

## One-time setup (owner)

1. Settings → Environments → New environment `producao` → Required reviewers: the owner.
2. In that environment, add the secret `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens).

The token must exist only there. This repository is public: never add it as a repository secret,
never paste it in a chat, an issue or a commit.

## What every run checks first

- Commits are full 40-character SHAs. A branch name is refused: a branch can move after the review.
- The token must see exactly one project with the production ref **and** its name, organization and
  region. If the CLI stops reporting any of the four, the run stops instead of assuming.
- Each function must exist, be ACTIVE and have the JWT gate it is supposed to have
  (`pluggy-hora` and `pluggy-webhook` run without it; cron and Pluggy call them).
- The published version and bundle hash of each function are recorded in the run summary and in
  the artifact `edge-registro-antes-<run>` (hashes and versions only, kept 90 days).

## comparar (read-only)

Inputs: `acao=comparar`, `funcoes`, `sha`.

For each function the published bundle is downloaded and compared with commit `sha` in both
directions:

| Result line | Meaning |
| --- | --- |
| `IGUAL` | every file the function imports in the repo is in production with the same bytes, and production has nothing else |
| `DIFERENTE [conteudo]` | same file, different bytes |
| `DIFERENTE [so_fim_de_linha]` | differs only by line endings / final newline; still a difference, reported so it can be explained |
| `SÓ NO REPOSITÓRIO` | the function imports it here; production does not have it |
| `SÓ EM PRODUÇÃO` | production has it; the function does not import it here |
| `INCONCLUSIVO` | the download could not be read as expected; this is never treated as equal |

Limits of the download, by design of a bundle:

- only the import graph of `index.ts` is in production (including `../_shared`); files nobody
  imports are not there and are not compared;
- every function carries its own copy of the shared files, so they are compared per function;
- remote imports (`https:`, `npm:`, `jsr:`) are counted, not compared;
- settings are not in the bundle; version and JWT gate are checked through the function list;
- the Supabase CLI version is fixed in the workflow. If a version cannot return the original
  bytes, the result is `INCONCLUSIVO`, and the answer is to fix the tool, not to publish.

## publicar (one function per run, two approvals)

Inputs: `acao=publicar`, `funcoes=<one>`, `sha=<commit to publish>`,
`base_sha=<commit production must be running now>`, `versao_atual=<version seen in the last comparar>`.

1. Job `verificar` (first approval): same checks as `comparar`, against `base_sha`. Any difference,
   or a version other than `versao_atual`, stops the run. Nothing is published.
2. Job `publicar` (second approval, after reading the first job's summary): confirms the project
   again and that nothing changed since job 1, publishes the function from `sha`, downloads it and
   compares it with `sha`. The summary records previous version → new version and both commits.

After each function: check its logs and behaviour before starting the next run.

## Rollback

The summary of every publication prints the exact inputs. It is the same workflow, swapped:

    acao=publicar  funcoes=<function>  sha=<previous commit>  base_sha=<commit just published>  versao_atual=<new version>

It goes through the same two approvals and the same proof. Two cases need a person before anything else:

- the proof after publishing fails (published bytes differ from `sha`): run the rollback above; if
  it is refused because production matches neither commit, stop and compare by hand;
- `comparar` says production matches no commit: do not publish over it. Find out what is there first.
