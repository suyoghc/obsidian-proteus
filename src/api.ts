/**
 * Anthropic API client — ported from anki-proteus generator.py _call_api
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export interface ApiResponse {
    text: string;
    input_tokens: number;
    output_tokens: number;
}

export async function callApi(
    apiKey: string,
    model: string,
    system: string,
    userMessage: string,
    maxTokens: number = 300,
    timeoutMs: number = 15000,
): Promise<ApiResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: model || DEFAULT_MODEL,
                max_tokens: maxTokens,
                system,
                messages: [{ role: "user", content: userMessage }],
            }),
            signal: controller.signal,
        });

        if (!resp.ok) {
            console.error(`[Proteus] API error ${resp.status}`);
            return null;
        }

        const result = await resp.json();
        const usage = result.usage || {};
        for (const block of result.content || []) {
            if (block.type === "text") {
                return {
                    text: block.text.trim(),
                    input_tokens: usage.input_tokens || 0,
                    output_tokens: usage.output_tokens || 0,
                };
            }
        }
    } catch (e: any) {
        if (e.name === "AbortError") {
            console.error("[Proteus] API call timed out");
        } else {
            console.error(`[Proteus] API call failed: ${e}`);
        }
    } finally {
        clearTimeout(timer);
    }
    return null;
}

export { DEFAULT_MODEL };
