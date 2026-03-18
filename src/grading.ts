/**
 * Response grading — ported from anki-proteus generator.py
 */

import { callApi, DEFAULT_MODEL } from "./api";
import { VARIANT_STYLES, bloomCognitiveLevel } from "./styles";

// ---------------------------------------------------------------------------
// Grading prompts
// ---------------------------------------------------------------------------

const GRADING_SYSTEM_CANONICAL = `You are a response evaluator for a spaced repetition system.

The learner was shown a question and gave a spoken/typed response. Your job is to
evaluate whether their response demonstrates understanding of the concept.

You are given the expected answer for the variant question. Use it as the answer target.
First, decide whether the shown question is aligned to the canonical answer target.

Rules:
- The response may be voice-transcribed: ignore filler words, disfluencies, grammar
  issues, and informal phrasing. Evaluate ONLY conceptual correctness.
- Compare against the canonical answer provided.
- Be encouraging but honest.
- If question and canonical answer are misaligned, DO NOT grade correctness.
- Always provide useful related-learning observations in "learning_feedback".

Return your evaluation as a JSON object with exactly these keys:
- "alignment": string — one of "aligned", "partial", "misaligned"
- "alignment_note": string — short reason for the alignment judgment
- "canonical_points": array of strings — core answer points to check
- "covered_points": array of strings — canonical points the learner covered
- "missed_points": array of strings — canonical points the learner missed
- "coverage_pct": integer 0..100
- "question_gap_points": array of strings — canonical points not tested by the shown question
- "learning_feedback": array of strings — concise related insights
- "incorrect": array of strings — things stated incorrectly
- "overall": string — 1 sentence summary

Output limits (strict):
- "alignment_note": max 18 words. "overall": max 18 words.
- Each array item: max 14 words.
- Max 2 items in "learning_feedback". Max 3 items in point arrays. Max 2 in "incorrect".

Return ONLY the JSON object, no markdown fences.`;

const GRADING_SYSTEM_BOTH = `You are a response evaluator for a spaced repetition system.

The learner was shown a question and gave a spoken/typed response. Your job is to
evaluate their response from TWO perspectives: against the provided expected answer,
and against the canonical flashcard answer.

First, decide whether the shown question is aligned to the canonical answer target.

Rules:
- The response may be voice-transcribed: ignore filler words, disfluencies, grammar
  issues, and informal phrasing. Evaluate ONLY conceptual correctness.
- Be encouraging but honest.
- If question and canonical answer are misaligned, DO NOT grade canonical correctness.
- Always provide useful related-learning observations in "learning_feedback".

Return your evaluation as a JSON object with exactly these keys:

Expected answer perspective:
- "ai_covered_points": array — expected-answer points addressed
- "ai_missed_points": array — expected-answer points missed
- "ai_coverage_pct": integer 0..100

Canonical answer perspective:
- "alignment": string — "aligned", "partial", or "misaligned"
- "alignment_note": string
- "canonical_points": array
- "covered_points": array — canonical points covered
- "missed_points": array — canonical points missed
- "coverage_pct": integer 0..100
- "question_gap_points": array

Shared:
- "learning_feedback": array (max 2 items)
- "incorrect": array (max 2 items)
- "overall": string (max 18 words)

Return ONLY the JSON object, no markdown fences.`;

const GRADING_USER_TEMPLATE = `Question shown: {question}

Expected answer: {expected_answer}

Canonical answer: {answer}

Learner's response: {response}

Evaluate their response as JSON.`;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function uniqCleanList(items: any, limit: number): string[] {
    if (!Array.isArray(items)) items = items ? [items] : [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const text = String(item).trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        out.push(text);
        if (out.length >= limit) break;
    }
    return out;
}

export interface GradingResult {
    alignment: string;
    alignment_note: string;
    expected_answer: string;
    canonical_points: string[];
    covered_points: string[];
    missed_points: string[];
    coverage_pct: number | null;
    question_gap_points: string[];
    learning_feedback: string[];
    incorrect: string[];
    overall: string;
    ai_covered_points?: string[];
    ai_missed_points?: string[];
    ai_coverage_pct?: number | null;
}

function normalizePayload(data: any, expectedAnswer: string): GradingResult {
    let alignment = String(data.alignment || "aligned").trim().toLowerCase();
    if (!["aligned", "partial", "misaligned"].includes(alignment)) alignment = "aligned";

    const alignmentNote = String(data.alignment_note || "").trim();
    let ea = String(data.expected_answer || "").trim() || expectedAnswer;
    const learningFeedback = uniqCleanList(data.learning_feedback, 2);
    let canonicalPoints = uniqCleanList(data.canonical_points, 3);
    let coveredPoints = uniqCleanList(data.covered_points || data.correct, 3);
    let missedPoints = uniqCleanList(data.missed_points || data.missed, 3);
    const questionGapPoints = uniqCleanList(data.question_gap_points, 3);
    const incorrect = uniqCleanList(data.incorrect, 2);
    const overall = String(data.overall || "").trim();

    if (!canonicalPoints.length) {
        canonicalPoints = uniqCleanList([...coveredPoints, ...missedPoints], 3);
    }
    if (!ea && canonicalPoints.length) {
        ea = canonicalPoints.slice(0, 3).join("; ");
    }

    let coveragePct: number | null = null;

    if (alignment === "misaligned") {
        canonicalPoints = [];
        coveredPoints = [];
        missedPoints = [];
        coveragePct = 0;
    } else {
        let denom = canonicalPoints.length || (coveredPoints.length + missedPoints.length);
        if (denom > 0) {
            coveragePct = Math.round((100 * Math.min(coveredPoints.length, denom)) / denom);
        }
        if (coveragePct !== null) coveragePct = Math.max(0, Math.min(100, coveragePct));
    }

    // AI fields
    const aiCovered = uniqCleanList(data.ai_covered_points, 3);
    const aiMissed = uniqCleanList(data.ai_missed_points, 3);
    let aiCoveragePct: number | null = null;
    if (aiCovered.length || aiMissed.length) {
        const aiDenom = aiCovered.length + aiMissed.length;
        if (aiDenom > 0) aiCoveragePct = Math.round((100 * aiCovered.length) / aiDenom);
    }

    const result: GradingResult = {
        alignment,
        alignment_note: alignmentNote,
        expected_answer: ea,
        canonical_points: canonicalPoints,
        covered_points: coveredPoints,
        missed_points: missedPoints,
        coverage_pct: coveragePct,
        question_gap_points: questionGapPoints,
        learning_feedback: learningFeedback,
        incorrect,
        overall,
    };

    if (aiCovered.length || aiMissed.length || aiCoveragePct !== null) {
        result.ai_covered_points = aiCovered;
        result.ai_missed_points = aiMissed;
        result.ai_coverage_pct = aiCoveragePct;
    }

    return result;
}

// ---------------------------------------------------------------------------
// Grade response
// ---------------------------------------------------------------------------

export async function gradeResponse(
    variantQuestion: string,
    userResponse: string,
    canonicalAnswer: string,
    config: {
        api_key: string;
        model?: string;
        grading_model?: string;
        grading_max_tokens?: number;
        grading_timeout_s?: number;
        feedback_mode?: string;
        variant_style?: string;
        _grading_note_age?: number;
    },
    expectedAnswer: string = "",
): Promise<GradingResult | null> {
    const apiKey = config.api_key;
    if (!apiKey) return null;

    const baseModel = config.model || DEFAULT_MODEL;
    const model = config.grading_model || baseModel;
    let maxTokens = config.grading_max_tokens || 280;
    const feedbackMode = config.feedback_mode || "canonical";
    const ea = expectedAnswer || "";

    let system: string;
    if (feedbackMode === "both") {
        system = GRADING_SYSTEM_BOTH.trim();
        maxTokens = Math.round(maxTokens * 1.4);
    } else {
        system = GRADING_SYSTEM_CANONICAL.trim();
    }

    // Style-specific grading addendum
    const styleName = config.variant_style || "wozniak_matuschak";
    const style = VARIANT_STYLES[styleName] || VARIANT_STYLES["wozniak_matuschak"];
    let addendum = style.grading_addendum || "";
    if (addendum && styleName === "bloom") {
        addendum = addendum.replace(
            /\{cognitive_level\}/g,
            bloomCognitiveLevel(config._grading_note_age || 0),
        );
    }
    if (addendum) system += "\n\n" + addendum;

    const userMsg = GRADING_USER_TEMPLATE
        .replace("{question}", variantQuestion)
        .replace("{expected_answer}", ea)
        .replace("{answer}", canonicalAnswer)
        .replace("{response}", userResponse);

    const resp = await callApi(apiKey, model, system, userMsg, maxTokens);
    if (!resp) return null;

    try {
        const data = JSON.parse(resp.text);
        return normalizePayload(data, ea);
    } catch {
        return null;
    }
}
