/**
 * Anthropic API client — uses Obsidian's requestUrl to bypass CORS.
 */

import { requestUrl } from "obsidian";

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
): Promise<ApiResponse | null> {
    try {
        const resp = await requestUrl({
            url: API_URL,
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
        });

        if (resp.status !== 200) {
            console.error(`[Proteus] API error ${resp.status}: ${resp.text}`);
            return null;
        }

        const result = resp.json;
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
        console.error(`[Proteus] API call failed: ${e}`);
    }
    return null;
}

export { DEFAULT_MODEL };
