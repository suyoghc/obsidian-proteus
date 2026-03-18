/**
 * Variant style registry — ported from anki-proteus generator.py
 *
 * Each style defines a system prompt, length constraints, and
 * grading addendum. The variant generator randomly picks from
 * the user's selected styles.
 */

export interface VariantStyle {
    system_prompt: string;
    max_words: number;
    max_chars: number;
    grading_addendum: string;
    visual?: boolean;
    artifact_key?: string;
}

const SHARED_STYLE = `
Style rules:
- Do NOT include the answer in your question.
- Get to the point immediately. No preamble, no setup, no "In the context of...".
- Each sentence must be under 12 words. Break longer thoughts into separate sentences.
- No subordinate clauses. No filler words. No jargon-heavy compound phrases.
- Use plain text (no markdown formatting).`;

const JSON_FOOTER = `
Return a JSON object with exactly two keys:
- "question": the new variant question text
- "expected_answer": concise answer to the variant question

Return ONLY the JSON object, no markdown fences.`;

const VISUAL_JSON_FOOTER = `
Return a JSON object with exactly three keys:
- "svg": an inline SVG diagram (simple shapes, text labels, under 2KB)
- "question": a short text prompt referencing the diagram (e.g., "Label parts A, B, C")
- "expected_answer": the correct labels/answers

Return ONLY the JSON object, no markdown fences.`;

export const VARIANT_STYLES: Record<string, VariantStyle> = {
    wozniak_matuschak: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate a SINGLE new question\n" +
            "that tests the SAME underlying concept but looks different, plus a concise expected answer.\n\n" +
            "Question design principles (minimum information principle):\n" +
            "- Test exactly ONE piece of knowledge. Never combine two asks.\n" +
            "- Word the question so there is only one correct, unambiguous answer.\n" +
            "- Anchor the question to something concrete — a scenario, example, or vivid image.\n" +
            "- Never ask the learner to list or enumerate. Ask about one specific item.\n" +
            "- Cloze deletion style ('_____ is the term for...') is acceptable.\n" +
            "- Vary the angle: rephrase, pose a scenario, ask 'what goes wrong if...',\n" +
            "  ask the learner to explain why, or present an error to identify.\n" +
            "- Do NOT make the question significantly harder or easier than the original.\n" +
            "- Keep the question concise — never longer than the original question.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- ONE fact only. If the question asks for one thing, the answer is one thing.\n" +
            "- No semicolons joining multiple statements. No lists.\n" +
            "- Max 15 words. Short, direct, single sentence.\n" +
            JSON_FOOTER,
        max_words: 26,
        max_chars: 180,
        grading_addendum: "The expected answer should contain exactly one atomic fact. Grade the learner's response against that single fact only.",
    },

    bloom: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate a SINGLE new question\n" +
            "at the {cognitive_level} level of Bloom's taxonomy, plus a concise expected answer.\n\n" +
            "Bloom's level guidance:\n" +
            "- Remember/Understand: 'What is...', 'Define...', 'Which of these...'\n" +
            "- Understand/Apply: 'Why does...', 'Given scenario X, what would...'\n" +
            "- Apply/Analyze: 'Compare X and Y', 'What would happen if...'\n" +
            "- Analyze/Evaluate: 'Evaluate whether...', 'What is the strongest argument for...'\n\n" +
            "Generate at the {cognitive_level} level. Test the SAME concept as the original.\n" +
            "- Do NOT make it significantly harder or easier than the target level demands.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Match the cognitive demand of the {cognitive_level} level.\n" +
            "- Concise ideal answer (max 28 words). Short, direct sentences.\n" +
            JSON_FOOTER,
        max_words: 30,
        max_chars: 210,
        grading_addendum: "Evaluate whether the response demonstrates the {cognitive_level} cognitive level, not just factual recall.",
    },

    elaborative: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate a SINGLE\n" +
            "'why' or 'how' question that forces the learner to explain the mechanism or\n" +
            "reason behind the concept, plus a concise expected answer.\n\n" +
            "Rules:\n" +
            "- The question MUST start with 'Why' or 'How'.\n" +
            "- Do NOT accept a factual label as the answer — the expected answer must include reasoning.\n" +
            "- Test the SAME concept as the original.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Focus on causal or mechanistic reasoning.\n" +
            "- Concise ideal answer (max 28 words). Short, direct sentences.\n" +
            JSON_FOOTER,
        max_words: 30,
        max_chars: 210,
        grading_addendum: "Evaluate depth of causal/mechanistic reasoning, not just factual recall.",
    },

    feynman: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), ask the learner to\n" +
            "explain the concept in simple terms, as if teaching a beginner.\n" +
            "Also provide a concise expected answer.\n\n" +
            "Rules:\n" +
            "- Use 'Explain...' or 'Describe in simple terms...' framing.\n" +
            "- The learner should demonstrate they understand, not just recall a definition.\n" +
            "- Test the SAME concept as the original.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Provide a simplified explanation using analogies or plain language.\n" +
            "- Max 50 words. Clarity over precision.\n" +
            JSON_FOOTER,
        max_words: 50,
        max_chars: 350,
        grading_addendum: "Evaluate clarity and simplicity of the explanation. Analogies and plain language are preferred over technical jargon.",
    },

    cloze_generation: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), create a fill-in-the-blank\n" +
            "statement where the learner must produce the key term or phrase from memory.\n\n" +
            "Rules:\n" +
            "- Convert the concept into a declarative statement with exactly ONE blank (_____).\n" +
            "- The blank must replace the most important term or phrase — the thing worth remembering.\n" +
            "- The surrounding context must make the answer unambiguous — only one correct fill.\n" +
            "- Do NOT blank out trivial words (articles, prepositions). Blank the core concept.\n" +
            "- The statement should be self-contained — no need to read the original question.\n" +
            "- Test the SAME concept as the original flashcard.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- The exact word(s) that fill the blank. Nothing else.\n" +
            "- Max 5 words.\n" +
            JSON_FOOTER,
        max_words: 30,
        max_chars: 210,
        grading_addendum: "The learner was given a fill-in-the-blank statement. Evaluate whether their response matches the blanked term. Accept synonyms and minor wording differences if the core concept is correct.",
    },

    real_world: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate a question\n" +
            "that embeds the concept in a REAL, specific, named real-world example.\n\n" +
            "Rules:\n" +
            "- Use a real event, person, company, study, or case — not a made-up scenario.\n" +
            "- Name specifics (who, when, where). Vague examples fail.\n" +
            "- The learner identifies the concept from the example.\n" +
            "- Test the SAME concept as the original flashcard.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Name the concept and briefly connect it to the example.\n" +
            "- Max 20 words.\n" +
            JSON_FOOTER,
        max_words: 35,
        max_chars: 250,
        grading_addendum: "Evaluate whether the learner correctly identifies the concept illustrated by the real-world example.",
    },

    discrimination: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate a SINGLE question\n" +
            "that asks how the concept differs from a related or commonly confused concept.\n" +
            "Also provide a concise expected answer.\n\n" +
            "Rules:\n" +
            "- The question MUST name both concepts explicitly.\n" +
            "- Ask about the key distinguishing feature(s).\n" +
            "- Pick a contrast that is genuinely confusable, not trivially different.\n" +
            "- Test the SAME concept as the original.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Identify the key distinguishing feature(s) between the two concepts.\n" +
            "- Concise ideal answer (max 28 words). Short, direct sentences.\n" +
            JSON_FOOTER,
        max_words: 30,
        max_chars: 210,
        grading_addendum: "Evaluate whether the response correctly identifies the distinguishing boundary between the concepts.",
    },

    transfer_code: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate a short\n" +
            "code snippet that embeds the concept, plus a question about it.\n\n" +
            "Rules:\n" +
            "- Show a realistic code snippet (Python preferred, 3-8 lines).\n" +
            "- The code must illustrate or violate the concept from the flashcard.\n" +
            "- Ask: debug it, predict output, improve it, or identify the technique.\n" +
            "- Test the SAME concept as the original flashcard.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Name the concept and explain how it applies to the code.\n" +
            "- Max 20 words.\n\n" +
            'Return a JSON object with exactly three keys:\n' +
            '- "code": the code snippet (plain text, no markdown fences)\n' +
            '- "question": a short question about the code\n' +
            '- "expected_answer": the answer connecting code to concept\n\n' +
            "Return ONLY the JSON object, no markdown fences.\n",
        max_words: 25,
        max_chars: 180,
        grading_addendum: "The learner was shown a code snippet. Evaluate whether they correctly identify the concept illustrated and how it applies.",
        visual: true,
        artifact_key: "code",
    },

    transfer_stats: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate realistic\n" +
            "statistical output that embeds the concept, plus a question about it.\n\n" +
            "Rules:\n" +
            "- Show model output, residual patterns, coefficient tables, or test results.\n" +
            "- Use plain text formatting (aligned columns, no markdown).\n" +
            "- The output must illustrate or violate the concept from the flashcard.\n" +
            "- Ask: interpret, diagnose, or identify the assumption/technique.\n" +
            "- Test the SAME concept as the original flashcard.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Name the concept and explain how the output shows it.\n" +
            "- Max 20 words.\n\n" +
            'Return a JSON object with exactly three keys:\n' +
            '- "code": the statistical output (plain text)\n' +
            '- "question": a short question about the output\n' +
            '- "expected_answer": the answer connecting output to concept\n\n' +
            "Return ONLY the JSON object, no markdown fences.\n",
        max_words: 25,
        max_chars: 180,
        grading_addendum: "The learner was shown statistical output. Evaluate whether they correctly interpret it and identify the relevant concept.",
        visual: true,
        artifact_key: "code",
    },

    transfer_math: {
        system_prompt:
            "You are a question variant generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), generate a short\n" +
            "equation, proof step, or worked example that embeds the concept, plus a question.\n\n" +
            "Rules:\n" +
            "- Show an equation, derivation step, or worked example (2-5 lines).\n" +
            "- Use plain text math notation (e.g., x^2, sqrt(n), sum_{i=1}^{n}).\n" +
            "- The math must illustrate, apply, or contain an error related to the concept.\n" +
            "- Ask: find the error, identify the technique, or predict the next step.\n" +
            "- Test the SAME concept as the original flashcard.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- Name the concept and explain how it applies to the math shown.\n" +
            "- Max 20 words.\n\n" +
            'Return a JSON object with exactly three keys:\n' +
            '- "code": the mathematical content (plain text)\n' +
            '- "question": a short question about it\n' +
            '- "expected_answer": the answer connecting math to concept\n\n' +
            "Return ONLY the JSON object, no markdown fences.\n",
        max_words: 25,
        max_chars: 180,
        grading_addendum: "The learner was shown a mathematical expression or derivation. Evaluate whether they correctly identify the concept or error.",
        visual: true,
        artifact_key: "code",
    },

    diagram_labeling: {
        system_prompt:
            "You are a visual flashcard generator for a spaced repetition system.\n\n" +
            "Your job: given an original flashcard (question + answer), create an SVG diagram\n" +
            "with labeled blanks (A, B, C, etc.) and a question asking the learner to identify them.\n\n" +
            "SVG rules:\n" +
            "- Simple shapes only: rect, circle, line, text, path. Under 2KB.\n" +
            "- Use viewBox='0 0 400 250' for consistent sizing.\n" +
            "- Monochrome: black strokes (#333), light gray fills (#f0f0f0), white background.\n" +
            "- Mark blanks with bold letters (A, B, C) in red (#d32f2f).\n" +
            "- CRITICAL: The SVG must NEVER contain the answers. Use ONLY the letters A, B, C as labels.\n" +
            "  Do NOT write the actual names, terms, or descriptions in the diagram.\n" +
            "  The diagram shows structure/relationships; the letters mark what to identify.\n" +
            "- No external references (fonts, images). Everything inline.\n" +
            "- The diagram must be meaningful — not decorative.\n" +
            '- If the concept CANNOT be meaningfully represented as a diagram,\n' +
            '  set "svg" to null and return a text-only question instead.\n\n' +
            "Question rules:\n" +
            "- The text question should reference the diagram: 'Identify parts A, B, C.'\n" +
            "- Test the SAME concept as the original flashcard.\n" +
            SHARED_STYLE +
            "\n\nExpected answer rules:\n" +
            "- List each label with its correct answer: 'A = ..., B = ..., C = ...'\n" +
            "- Max 3-4 labels per diagram.\n" +
            VISUAL_JSON_FOOTER,
        max_words: 30,
        max_chars: 210,
        grading_addendum: "The learner was shown a labeled diagram. Evaluate whether they correctly identified each labeled part. Partial credit for getting some labels right.",
        visual: true,
    },
};

export function bloomCognitiveLevel(noteAgeDays: number): string {
    if (noteAgeDays <= 7) return "Remember/Understand";
    if (noteAgeDays <= 30) return "Understand/Apply";
    if (noteAgeDays <= 90) return "Apply/Analyze";
    return "Analyze/Evaluate";
}
