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

## What's TODO

- [ ] Review panel (Obsidian ItemView with question/answer pages)
- [ ] Card storage (JSON in plugin data or note frontmatter)
- [ ] Spaced repetition scheduling
- [ ] Backlink-powered card generation
- [ ] Export to Anki (AnkiConnect)
- [ ] Command palette integration for generate + review

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
