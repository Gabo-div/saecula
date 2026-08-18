# Thesis — Proyecto Saecula

Thesis proposal documentation by **Miguel Nuñez and Gabriel Hernández** (Informatics Engineering, UNEG), advised by **Professor XXX**.

**Topic:** Design and implementation of a hybrid multilingual architecture based on graph databases and relational databases with MCP integration for processing historical data, theology, and Catholic history.

> The proposal documents (`proposal.md`, `thesis-idea.md`, `research-log.md`) are written in Spanish on purpose — that is the language the thesis is submitted in. Everything else here (this README, filenames, tooling) is in English.

---

## What this app is

`apps/thesis` is a small, self-contained workspace in the Saecula monorepo that
holds the thesis proposal sources and a Node/JS toolchain to render them into a
Word document with APA 7 formatting (UNEG adaptations). It has its own
`package.json` (bun workspace) and does not depend on the backend, CLI or
mobile app.

## Layout

| Path | Purpose |
|---|---|
| `src/proposal.md` | **Master document** of the proposal (YAML title page + Ch. I, II, III + references). All content edits happen here. |
| `src/thesis-idea.md` | Short summary of the thesis idea (the initial "idea", not the full document). |
| `src/research-log.md` | **Research log**: analysis of each source/prior work with links to read them manually, plus selection criteria. |
| `scripts/generate-word.mjs` | Node/JS script that converts the master `.md` into Word (APA 7 + UNEG: 2.54 cm margins, A4, TNR 12, 1.5 line spacing, justified, indentation, page numbering). |
| `README.md` | This file. |

The `.docx` produced by `generate-word.mjs` is a build artifact: never edited
by hand and not committed (see the root `.gitignore`).

## Workflow

1. **Edit content** always in `src/proposal.md`.
2. **Regenerate the Word file** after each change (from `apps/thesis`):
   ```bash
   bun run generate:word
   ```
   You can pass an explicit input/output:
   ```bash
   bun run generate:word src/proposal.md My-Output.docx
   ```
3. The script reads the title-page metadata from the YAML block at the top of
   the `.md`.

### Prerequisites

- Node.js and the `docx` npm dependency (installed via `bun install` at the
  repo root; this workspace is part of the bun workspaces).

---

## Document contents

- **Chapter I — The Problem:** statement (3 limitations), research question and sub-questions, objectives, justification, and scope.
- **Chapter II — Theoretical Framework:** prior work (Gao 2023, Lewis 2020, Peng 2024), theoretical bases, and Venezuelan legal bases.
- **Chapter III — Methodological Framework:** type/design, population and sample, techniques and instruments, procedure, SCRUM, and references.

---

## Pending

### Thesis document (text)

- [ ] **Regenerate the Word file after the latest `.md` edit** (added the third prior work, Lewis 2020).
- [ ] Review with the advisor (Professor XXX) the **citation style** and the UNEG/APA 7 formatting of the full document.
- [ ] Validate the **3 prior works** (Gao 2023, Lewis 2020, Peng 2024) with the advisor.
- [ ] (Optional) Find and add a real **national (Venezuela) prior work** if the advisor requires it.
- [ ] Manually read the sources in `research-log.md` and confirm the analyses (dates, authors, contributions) are correct.
- [ ] Proofread spelling, punctuation, and wording across the three chapters.
- [ ] Check **pagination** in Word: chapter titles and first paragraph on the same page; references with hanging indent.

### Research and references

- [ ] Confirm that **every in-text citation** has its matching entry in the reference list (and vice versa).
- [ ] Review the complementary sources in `research-log.md` (Theographic, BibleMind, MCP documentation) and decide whether to cite them.
- [ ] Define the **exact sample corpus** (5 OT books, 3 NT, acts of 4 councils, 2 Church Fathers, 10 saints) across its 4 languages.
