/**
 * Variant generation and grading — ported from anki-proteus generator.py
 */

import { callApi, DEFAULT_MODEL } from "./api";
import { VARIANT_STYLES, bloomCognitiveLevel, VariantStyle } from "./styles";

// ---------------------------------------------------------------------------
// Variant generation
// ---------------------------------------------------------------------------

const USER_TEMPLATE = `Original question: {question}

Original answer: {answer}

{domain_context}

Generate one variant question that tests the same concept.`;

export interface VariantResult {
    question: string;
    expected_answer: string;
    variant_style: string;
    svg?: string;
    code?: string;
}

function normalizeText(text: string): string {
    if (!text) return "";
    return text.replace(/\s+/g, " ").trim();
}

function variantTooLong(text: string, maxWords: number, maxChars: number): boolean {
    if (!text) return false;
    return text.split(/\s+/).length > maxWords || text.length > maxChars;
}

function hardLimitVariant(text: string, maxWords: number, maxChars: number): string {
    let variant = normalizeText(text);
    if (!variant) return "";

    const qIdx = variant.indexOf("?");
    if (qIdx !== -1 && qIdx + 1 <= maxChars) {
        variant = variant.slice(0, qIdx + 1).trim();
    }

    const words = variant.split(/\s+/);
    if (words.length > maxWords) {
        variant = words.slice(0, maxWords).join(" ").replace(/[,;:.]+$/, "");
    }

    if (variant.length > maxChars) {
        let clipped = variant.slice(0, maxChars);
        const lastSpace = clipped.lastIndexOf(" ");
        if (lastSpace > 0) clipped = clipped.slice(0, lastSpace);
        variant = clipped.replace(/[,;:.]+$/, "");
    }

    if (variant && !variant.endsWith("?")) {
        if (variant.length >= maxChars) {
            variant = variant.slice(0, maxChars - 1).replace(/[,;:.]+$/, "");
        }
        variant += "?";
    }

    return variant;
}

export async function generateVariant(
    question: string,
    answer: string,
    config: {
        api_key: string;
        model?: string;
        system_prompt?: string;
        learner_context?: string;
        variant_style?: string[];
    },
    noteAgeDays: number = 0,
): Promise<VariantResult | null> {
    const apiKey = config.api_key;
    if (!apiKey) return null;

    const model = config.model || DEFAULT_MODEL;

    // Pick a style
    const styleCfg = config.variant_style || ["wozniak_matuschak"];
    const styleName = styleCfg[Math.floor(Math.random() * styleCfg.length)] || "wozniak_matuschak";
    const style = VARIANT_STYLES[styleName] || VARIANT_STYLES["wozniak_matuschak"];

    const maxWords = style.max_words;
    const maxChars = style.max_chars;

    // Build system prompt
    let system = style.system_prompt;
    if (styleName === "bloom") {
        const level = bloomCognitiveLevel(noteAgeDays);
        system = system.replace(/\{cognitive_level\}/g, level);
    }
    system = system.trim();

    // Context
    const ctxParts: string[] = [];
    if (config.system_prompt) ctxParts.push(`Domain context: ${config.system_prompt}`);
    if (config.learner_context) ctxParts.push(`Learner context: ${config.learner_context}`);

    const userMsg = USER_TEMPLATE
        .replace("{question}", question)
        .replace("{answer}", answer)
        .replace("{domain_context}", ctxParts.join("\n"));

    const isVisual = style.visual || false;
    const apiMaxTokens = isVisual ? 1200 : 300;

    const resp = await callApi(apiKey, model, system, userMsg, apiMaxTokens);
    if (!resp) return null;

    let variant = "";
    let expectedAnswer = "";
    let svg = "";
    let artifactKey = style.artifact_key || "svg";

    try {
        const parsed = JSON.parse(resp.text);
        variant = normalizeText(String(parsed.question || ""));
        expectedAnswer = String(parsed.expected_answer || "").trim();
        if (isVisual) {
            const rawArtifact = parsed[artifactKey];
            if (rawArtifact && String(rawArtifact).trim().toLowerCase() !== "null") {
                svg = String(rawArtifact).trim();
            } else {
                // LLM opted out — fallback to text
                return {
                    question: variant || question,
                    expected_answer: expectedAnswer,
                    variant_style: "wozniak_matuschak",
                };
            }
        }
    } catch {
        if (isVisual) return null;
        variant = normalizeText(resp.text);
    }

    if (!variant) return null;
    if (isVisual && !svg) return null;

    // Length enforcement (skip for visual styles)
    if (!isVisual) {
        if (variantTooLong(variant, maxWords, maxChars)) {
            variant = hardLimitVariant(variant, maxWords, maxChars);
        }
    }

    if (!variant) return null;

    const result: VariantResult = {
        question: variant,
        expected_answer: expectedAnswer,
        variant_style: styleName,
    };
    if (svg && artifactKey === "code") result.code = svg;
    else if (svg) result.svg = svg;

    return result;
}

// ---------------------------------------------------------------------------
// Note parsing — extract Q+A concepts from Obsidian notes
// ---------------------------------------------------------------------------

export interface ExtractedConcept {
    question: string;
    answer: string;
    source_heading?: string;
}

/**
 * Extract Q+A pairs from a note using heading-based strategy.
 * Each heading that looks like a question becomes Q, content underneath becomes A.
 */
export function extractFromHeadings(markdown: string): ExtractedConcept[] {
    const concepts: ExtractedConcept[] = [];
    const lines = markdown.split("\n");
    let currentHeading = "";
    let currentContent: string[] = [];

    for (const line of lines) {
        const headingMatch = line.match(/^#{1,6}\s+(.+)/);
        if (headingMatch) {
            // Save previous section
            if (currentHeading && currentContent.length > 0) {
                const answer = currentContent.join(" ").trim();
                if (answer.length >= 10) {
                    concepts.push({
                        question: currentHeading,
                        answer,
                        source_heading: currentHeading,
                    });
                }
            }
            currentHeading = headingMatch[1].trim();
            currentContent = [];
        } else {
            const trimmed = line.trim();
            if (trimmed) currentContent.push(trimmed);
        }
    }

    // Last section
    if (currentHeading && currentContent.length > 0) {
        const answer = currentContent.join(" ").trim();
        if (answer.length >= 10) {
            concepts.push({
                question: currentHeading,
                answer,
                source_heading: currentHeading,
            });
        }
    }

    return concepts;
}

/**
 * Extract Q+A pairs from highlights (bold or ==highlight==).
 * Highlighted text becomes the answer; surrounding sentence is the question seed.
 */
export function extractFromHighlights(markdown: string): ExtractedConcept[] {
    const concepts: ExtractedConcept[] = [];
    // Match **bold** or ==highlight==
    const pattern = /\*\*(.+?)\*\*|==(.+?)==/g;
    let match;

    while ((match = pattern.exec(markdown)) !== null) {
        const highlighted = (match[1] || match[2]).trim();
        if (highlighted.length < 3) continue;

        // Get surrounding context (±100 chars)
        const start = Math.max(0, match.index - 100);
        const end = Math.min(markdown.length, match.index + match[0].length + 100);
        const context = markdown.slice(start, end).replace(/\s+/g, " ").trim();

        concepts.push({
            question: `What is significant about: "${highlighted}"?`,
            answer: highlighted,
        });
    }

    return concepts;
}

/**
 * Extract Q+A from ::flashcard markers.
 *
 * Format:
 * ::flashcard What is X?
 * The answer text.
 * ::end
 */
export function extractFromMarkers(markdown: string): ExtractedConcept[] {
    const concepts: ExtractedConcept[] = [];
    const pattern = /::flashcard\s+(.+?)\n([\s\S]*?)::end/g;
    let match;

    while ((match = pattern.exec(markdown)) !== null) {
        const question = match[1].trim();
        const answer = match[2].trim();
        if (question && answer) {
            concepts.push({ question, answer });
        }
    }

    return concepts;
}

/**
 * LLM-based extraction — send note text and ask for key concepts.
 */
export async function extractWithLLM(
    noteText: string,
    apiKey: string,
    model?: string,
    maxConcepts: number = 8,
): Promise<ExtractedConcept[]> {
    const system =
        "You extract key learning concepts from text.\n" +
        `Given a note, identify up to ${maxConcepts} discrete concepts worth remembering.\n` +
        "Return a JSON array: [{\"question\": \"...\", \"answer\": \"...\"}]\n" +
        "Each question should test one concept. Each answer should be concise (max 20 words).\n" +
        "Return ONLY the JSON array, no markdown fences.";

    const resp = await callApi(apiKey, model || DEFAULT_MODEL, system, noteText, 600);
    if (!resp) return [];

    try {
        const parsed = JSON.parse(resp.text);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((c: any) => c.question && c.answer)
            .map((c: any) => ({
                question: String(c.question).trim(),
                answer: String(c.answer).trim(),
            }));
    } catch {
        return [];
    }
}
