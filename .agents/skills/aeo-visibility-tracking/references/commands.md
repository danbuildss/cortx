---
title: Commands
description: Commands
---

Requires the ReddGrow CLI (`npm install -g @reddgrow/cli`, `reddgrow auth login …`) on a **Pro plan**. Use `--mode agent` for clean JSON. Check quota with `reddgrow aeo me`; reference data via `reddgrow aeo engines`, `reddgrow aeo countries`, `reddgrow aeo score-methodology`.

## Brands & topics

```bash
reddgrow aeo brands create --name <s> [--domain <s>]
reddgrow aeo brands list | ranking [--brand <id>] [--topic <id>] [--engine <e>] [--country <c>]
reddgrow aeo topics create --name <s> [--brand <id>]
reddgrow aeo topics batch --json '{"brand_id":N,"topics":["..."]}'
```

## Prompts & runs

```bash
reddgrow aeo prompts create --query <q> [--brand <id>] [--topic <id>] [--countries <c...>] [--category <s>] [--tags <t...>]
reddgrow aeo prompts batch --json '{"prompts":[...]}' | --json-file path.json
reddgrow aeo prompts batch-status <jobId>
reddgrow aeo prompts list [--brand <id>] [--topic <id>] [--engine <e>] [--country <c>]
reddgrow aeo prompts runs <id> [--engine <e>] [--country <c>] [--limit N]
reddgrow aeo runs get <scan_result_id>
reddgrow aeo runs explain <scan_result_id>
```

## Visibility, citations, sentiment

```bash
reddgrow aeo visibility timeline [--brand <id>] [--country <c>] [--days N]
reddgrow aeo visibility explain --brand <id> [--topic <id>] [--engine <e>] [--country <c>]
reddgrow aeo citations list [--brand <id>] [--engine <e>] [--domain <s>] [--domain-type <t>]
reddgrow aeo sources top-domains [--brand <id>] [--engine <e>] [--limit N]
reddgrow aeo sources domains | urls | domain-types [filters]
reddgrow aeo sources detail --scope <domain|url|query> --target <t>
reddgrow aeo sentiment explain --brand <id> [--topic <id>] [--engine <e>]
```
