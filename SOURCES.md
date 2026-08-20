# Text sources & licenses

Inventory of every scraped text, its edition, where it came from, and its
copyright status. **Licensing is not yet resolved** — this table is the record
of what we'd need to clear before shipping each text publicly.

Legend: **Have** = already scraped/seeded (`apps/cli/data/`). **Planned** =
recommended next, not yet scraped. Cross-language verse alignment keys on
`(book code, chapter, verse)`, so *versification* matters as much as the text.

## Bible

Scrape any of these with `saecula-cli scrape bible --source {cee|nova|web}`
(all three share the 73-book canon catalog in `libs/canon`, so entity IDs match
across languages).

| Lang | Edition (`translation_id`) | Source | Versification | License | Status |
|---|---|---|---|---|---|
| ES | CEE 2011 (`cee_2011`) | conferenciaepiscopal.es (`--source cee`) | modern (Hebrew) | © **Conferencia Episcopal Española / BAC** — all rights reserved | Scraped + seeded |
| EN | World English Bible, Catholic Edition (`web_ce`) | ebible.org USFM zip (`--source web`) | modern (Hebrew) → aligns with CEE | **Public domain** (PD dedication) | Scraper ready (not seeded) |
| LA | Nova Vulgata (`nova_vulgata`) | vatican.va/archive/bible/nova_vulgata (`--source nova`) | modern (Hebrew) → aligns with CEE | © **Libreria Editrice Vaticana** — no open license | Scraper ready (not seeded) |

**Book names** are scraped from each edition and persisted per translation
(`text_documents` rows keyed `BOOK.<code>`), so the reader shows each version's
own naming — e.g. Genesis is "Génesis" (CEE), "LIBER GENESIS" (Nova Vulgata),
"Genesis" (WEB) — instead of a shared catalog label. `/api/bible/books` and the
chapter endpoint return the name for the selected `translation`, falling back
to the `libs/canon` catalog when a source has none.

**Alignment notes** (all three key on `(book code, chapter, verse)`):
- NV and CEE agree on chapter counts for all 73 books. WEB-CE differs only on
  **Joel** (English 3-chapter vs 4) and **Malachi** (English 4-chapter vs 3) —
  the standard English-tradition splits.
- The Greek additions to **Esther** and **Daniel** use their own sub-verse
  lettering; NV keeps the first marker per verse number (like the CEE scraper),
  and WEB-CE ships them as USFM `ESG`/`DAG`, mapped onto `EST`/`DAN`. Those
  specific books may not align verse-for-verse across the three.

**PD fallbacks for Latin/English** if LEV licensing can't be cleared: Vulgata
Clementina + Douay-Rheims (Challoner), both public domain (drbo.org). Caveat:
both use **old (LXX) versification** — Psalm numbering off-by-one vs CEE, plus
Esther/Daniel/Tobit differences — so they'd need a versification remap table to
align with the Spanish, or accept the Spanish sitting in its own numbering.

## Catechism (CCC, 2865 §§)

| Lang | Edition (`translation_id`) | Source | License | Status |
|---|---|---|---|---|
| EN | Vatican (`ccc_vatican_en`) | vatican.va | © **LEV / USCCB** | Have |
| ES | Vatican (`ccc_vatican_es`) | vatican.va | © **LEV** | Have |
| LA | Vatican (`ccc_vatican_la`) | vatican.va | © **LEV** | Have |
| EN | St. Charles Borromeo (`ccc_scborromeo_en`), 2848 §§ | scborromeo.org | © **LEV** (reproduced text) | Have (alt/partial, unused) |

## Daily readings

| Lang | Edition (`translation_id`) | Source | License | Status |
|---|---|---|---|---|
| EN | USCCB lectionary (`usccb_lectionary`), 351 days | bible.usccb.org | © **USCCB** (lectionary + NABRE text) | Have |
| ES | Vatican News / CEM (`vaticannews_cem`), 316 days | vaticannews.va | © **Vatican News / CEM** | Have |

## Other

- **Daily feasts** (`daily_feasts.json`, 17) — our own curated compilation.
- **Catechism citations** (`citations_catechism.json`) — derived cross-references, internal.
- **Prayers** — seeded from `libs/canon`; wording follows common liturgical form (public/traditional texts).

## Summary

Everything currently seeded is **copyrighted** (CEE, LEV, USCCB, Vatican News).
The only public-domain text in the pipeline is the **planned WEB-CE** English
Bible. Latin (Nova Vulgata) and all Catechism/readings texts would need
permission — or a PD substitute — to redistribute publicly.
