# Obsidian Proteus

Generate LLM-powered flashcard variants from your Obsidian notes using research-backed question styles.

Part of the Proteus family — same prompt engineering and variant styles as [anki-proteus](https://github.com/suyoghc/anki-proteus), adapted for Obsidian's note-based workflow.

## Status

**Early development.** Core logic (styles, generation, grading) is ported from anki-proteus. Plugin scaffold and settings are in place. Review UI and storage are TODO.

## What works

- Plugin loads in Obsidian with settings tab
- All 10 variant styles ported (TypeScript)
- API client for Anthropic
- Note parsing: heading-based, highlight-based, marker-based, LLM extraction
- Variant generation and grading logic

## How it works

1. Open a note in Obsidian
2. Run **"Proteus: Generate flashcards from current note"** from the command palette
3. Proteus extracts concepts, generates variant Q+A pairs using the selected styles
4. Cards are appended to your note under a `## Flashcards` heading in obsidian-spaced-repetition format
5. The SR plugin handles scheduling and review

### Card format (obsidian-spaced-repetition compatible)

```markdown
## Flashcards

What function links the linear predictor to the response? %%proteus:wozniak_matuschak%%
?
The logit function.

_____ accounts for non-independence in nested data. %%proteus:cloze_generation%%
?
Multilevel modeling.
```

### Commands

- **Generate flashcards from current note** — extract + generate + append
- **Refresh flashcards in current note** — remove old Proteus cards, regenerate
- **Review flashcards** — points to obsidian-spaced-repetition for review

## Dependencies

- [obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) — handles scheduling and review

## What's TODO

- [ ] Backlink-powered card generation (use knowledge graph for discrimination style)
- [ ] Export to Anki (AnkiConnect)
- [ ] Inline review panel (independent of SR plugin)

## Concept extraction strategies

### Heading-based (default)
Each heading becomes a question, content underneath becomes the answer.

### Highlight-based
**Bold** or ==highlighted== text becomes the answer, surrounding context seeds the question.

### Marker-based
Explicit markers in your notes:
```
::flashcard What is heteroscedasticity?
Non-constant variance of residuals across levels of a predictor.
::end
```

### LLM extraction
Send the note to the LLM and ask for key concepts. Most flexible, costs one API call.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

Symlink into your vault's plugins folder:
```bash
ln -s /path/to/obsidian-proteus /path/to/vault/.obsidian/plugins/obsidian-proteus
```
