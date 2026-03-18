/**
 * Integration with obsidian-spaced-repetition plugin.
 *
 * Generates Proteus variant cards and writes them in the format
 * that obsidian-spaced-repetition recognizes:
 *
 *   Question text
 *   ?
 *   Answer text
 *
 * Cards are appended to the source note under a "## Flashcards" heading.
 * The SR plugin picks them up and handles scheduling.
 */

import { App, TFile, Notice } from "obsidian";
import { VariantResult } from "./generator";

const FLASHCARD_HEADING = "## Flashcards";
const SEPARATOR = "\n?\n";

/**
 * Format a single Proteus variant as an SR-compatible flashcard block.
 */
export function formatSRCard(variant: VariantResult): string {
    const q = variant.question.trim();
    const a = variant.expected_answer.trim();
    if (!q || !a) return "";

    // Add style tag as a comment for traceability
    const styleTag = variant.variant_style
        ? ` %%proteus:${variant.variant_style}%%`
        : "";

    return `${q} #flashcard${styleTag}${SEPARATOR}${a}`;
}

/**
 * Format a code/stats/math transfer card with artifact.
 */
export function formatSRCardWithArtifact(variant: VariantResult): string {
    const artifact = variant.code || "";
    const q = variant.question.trim();
    const a = variant.expected_answer.trim();
    if (!q || !a) return "";

    const codeBlock = artifact
        ? `\n\`\`\`\n${artifact}\n\`\`\`\n\n${q}`
        : q;

    const styleTag = variant.variant_style
        ? ` %%proteus:${variant.variant_style}%%`
        : "";

    return `${codeBlock} #flashcard${styleTag}${SEPARATOR}${a}`;
}

/**
 * Append generated flashcards to a note under a ## Flashcards heading.
 *
 * If the heading doesn't exist, it's created at the end of the note.
 * Cards are separated by blank lines.
 */
export async function appendCardsToNote(
    app: App,
    file: TFile,
    variants: VariantResult[],
): Promise<number> {
    if (!variants.length) return 0;

    const cards = variants
        .map((v) => {
            if (v.code) return formatSRCardWithArtifact(v);
            return formatSRCard(v);
        })
        .filter((c) => c.length > 0);

    if (!cards.length) return 0;

    const cardBlock = cards.join("\n\n");

    let content = await app.vault.read(file);

    const headingIdx = content.indexOf(FLASHCARD_HEADING);
    if (headingIdx !== -1) {
        // Append after existing flashcards section
        // Find the next heading or end of file
        const afterHeading = content.slice(headingIdx + FLASHCARD_HEADING.length);
        const nextHeadingMatch = afterHeading.match(/\n## /);
        const insertPos = nextHeadingMatch
            ? headingIdx + FLASHCARD_HEADING.length + nextHeadingMatch.index!
            : content.length;

        content =
            content.slice(0, insertPos).trimEnd() +
            "\n\n" +
            cardBlock +
            "\n\n" +
            content.slice(insertPos);
    } else {
        // Create the heading at the end
        content = content.trimEnd() + "\n\n" + FLASHCARD_HEADING + "\n\n" + cardBlock + "\n";
    }

    await app.vault.modify(file, content);
    return cards.length;
}

/**
 * Count existing Proteus-generated cards in a note.
 */
export function countProteusCards(content: string): number {
    return (content.match(/%%proteus:\w+%%/g) || []).length;
}

/**
 * Remove all Proteus-generated cards from a note's Flashcards section.
 */
export async function clearProteusCards(app: App, file: TFile): Promise<number> {
    let content = await app.vault.read(file);
    const headingIdx = content.indexOf(FLASHCARD_HEADING);
    if (headingIdx === -1) return 0;

    const before = content.slice(0, headingIdx);
    const section = content.slice(headingIdx);

    // Find the next non-flashcard heading
    const nextHeadingMatch = section.slice(FLASHCARD_HEADING.length).match(/\n## /);
    const sectionEnd = nextHeadingMatch
        ? FLASHCARD_HEADING.length + nextHeadingMatch.index!
        : section.length;

    const flashcardSection = section.slice(0, sectionEnd);
    const after = section.slice(sectionEnd);

    // Remove blocks containing %%proteus:...%%
    const blocks = flashcardSection.split(/\n\n+/);
    const kept = blocks.filter((b) => !b.includes("%%proteus:"));
    const removed = blocks.length - kept.length;

    const newSection = kept.join("\n\n");
    content = before + newSection + after;

    await app.vault.modify(file, content);
    return removed;
}
