/**
 * Obsidian Proteus — LLM-powered flashcard variants from your notes.
 *
 * Plugin entry point. Registers commands, settings, and the review view.
 */

import { Plugin, PluginSettingTab, Setting, App, Notice, TFile } from "obsidian";
import {
    generateVariant,
    extractFromHeadings,
    extractFromHighlights,
    extractFromMarkers,
    extractWithLLM,
    ExtractedConcept,
} from "./generator";
import { appendCardsToNote, clearProteusCards, countProteusCards } from "./sr-integration";

interface ProteusSettings {
    api_key: string;
    model: string;
    system_prompt: string;
    learner_context: string;
    variant_style: string[];
    feedback_mode: string;
    show_ai_coverage: boolean;
    extraction_strategy: string;
    max_concepts: number;
}

const DEFAULT_SETTINGS: ProteusSettings = {
    api_key: "",
    model: "claude-sonnet-4-20250514",
    system_prompt: "",
    learner_context: "",
    variant_style: ["wozniak_matuschak"],
    feedback_mode: "both",
    show_ai_coverage: false,
    extraction_strategy: "headings",
    max_concepts: 8,
};

export default class ProteusPlugin extends Plugin {
    settings: ProteusSettings = DEFAULT_SETTINGS;

    async onload() {
        await this.loadSettings();

        // Command: generate cards from current note
        this.addCommand({
            id: "generate-from-note",
            name: "Generate flashcards from current note",
            callback: () => this.generateFromCurrentNote(),
        });

        // Command: refresh cards in current note
        this.addCommand({
            id: "refresh-cards",
            name: "Refresh flashcards in current note",
            callback: () => this.refreshCurrentNote(),
        });

        // Command: review due cards
        this.addCommand({
            id: "review-cards",
            name: "Review flashcards",
            callback: () => this.openReviewPanel(),
        });

        // Settings tab
        this.addSettingTab(new ProteusSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async generateFromCurrentNote() {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            new Notice("Proteus: no active note");
            return;
        }
        if (!this.settings.api_key) {
            new Notice("Proteus: set API key in settings");
            return;
        }

        const content = await this.app.vault.read(file);
        new Notice(`Proteus: extracting concepts from "${file.basename}"...`);

        // Extract concepts based on strategy
        let concepts: ExtractedConcept[];
        switch (this.settings.extraction_strategy) {
            case "highlights":
                concepts = extractFromHighlights(content);
                break;
            case "markers":
                concepts = extractFromMarkers(content);
                break;
            case "llm":
                concepts = await extractWithLLM(
                    content,
                    this.settings.api_key,
                    this.settings.model,
                    this.settings.max_concepts,
                );
                break;
            default:
                concepts = extractFromHeadings(content);
        }

        if (!concepts.length) {
            new Notice("Proteus: no concepts found in this note");
            return;
        }

        new Notice(`Proteus: generating ${concepts.length} flashcards...`);

        // Calculate note age for Bloom's
        const noteAgeDays = Math.floor(
            (Date.now() - file.stat.ctime) / (1000 * 60 * 60 * 24),
        );

        // Generate variants for each concept
        const variants = [];
        for (const concept of concepts) {
            const result = await generateVariant(
                concept.question,
                concept.answer,
                this.settings,
                noteAgeDays,
            );
            if (result) variants.push(result);
        }

        if (!variants.length) {
            new Notice("Proteus: generation failed — check API key and model");
            return;
        }

        // Append to note in obsidian-spaced-repetition format
        const count = await appendCardsToNote(this.app, file, variants);
        new Notice(`Proteus: ${count} flashcards added to "${file.basename}"`);
    }

    async refreshCurrentNote() {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            new Notice("Proteus: no active note");
            return;
        }

        const content = await this.app.vault.read(file);
        const removed = await clearProteusCards(this.app, file);
        if (removed > 0) {
            new Notice(`Proteus: removed ${removed} old cards, regenerating...`);
        }
        await this.generateFromCurrentNote();
    }

    openReviewPanel() {
        // obsidian-spaced-repetition handles review — point the user there
        new Notice(
            "Proteus: use the Spaced Repetition plugin to review.\n" +
            "Cards are in your note's ## Flashcards section.",
        );
    }
}

class ProteusSettingTab extends PluginSettingTab {
    plugin: ProteusPlugin;

    constructor(app: App, plugin: ProteusPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Proteus Settings" });

        new Setting(containerEl)
            .setName("API Key")
            .setDesc("Your Anthropic API key")
            .addText((text) =>
                text
                    .setPlaceholder("sk-ant-...")
                    .setValue(this.plugin.settings.api_key)
                    .onChange(async (value) => {
                        this.plugin.settings.api_key = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Model")
            .setDesc("Anthropic model to use")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.model)
                    .onChange(async (value) => {
                        this.plugin.settings.model = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Domain context")
            .setDesc("Domain-specific context for better variant quality")
            .addTextArea((text) =>
                text
                    .setPlaceholder("e.g., The learner is a medical student...")
                    .setValue(this.plugin.settings.system_prompt)
                    .onChange(async (value) => {
                        this.plugin.settings.system_prompt = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Personal learning context")
            .setDesc("Describe yourself and what's currently relevant")
            .addTextArea((text) =>
                text
                    .setPlaceholder("e.g., PhD student preparing for quals...")
                    .setValue(this.plugin.settings.learner_context)
                    .onChange(async (value) => {
                        this.plugin.settings.learner_context = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Extraction strategy")
            .setDesc("How to extract Q+A from notes")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("headings", "Heading-based")
                    .addOption("highlights", "Highlights/bold")
                    .addOption("markers", "::flashcard markers")
                    .addOption("llm", "LLM extraction")
                    .setValue(this.plugin.settings.extraction_strategy)
                    .onChange(async (value) => {
                        this.plugin.settings.extraction_strategy = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Feedback mode")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("canonical", "Canonical only")
                    .addOption("ai", "AI answer only")
                    .addOption("both", "Both perspectives")
                    .setValue(this.plugin.settings.feedback_mode)
                    .onChange(async (value) => {
                        this.plugin.settings.feedback_mode = value;
                        await this.plugin.saveSettings();
                    }),
            );

        containerEl.createEl("h3", { text: "Variant Styles" });

        const styleLabels: Record<string, string> = {
            wozniak_matuschak: "Wozniak + Matuschak",
            bloom: "Bloom's Taxonomy",
            elaborative: "Elaborative (why/how)",
            feynman: "Feynman (explain simply)",
            cloze_generation: "Cloze Generation",
            real_world: "Real-World Examples",
            discrimination: "Discrimination (contrast)",
            transfer_code: "Transfer: Code",
            transfer_stats: "Transfer: Stats",
            transfer_math: "Transfer: Math",
            diagram_labeling: "Diagram Labeling (visual)",
        };

        for (const [key, label] of Object.entries(styleLabels)) {
            new Setting(containerEl)
                .setName(label)
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.variant_style.includes(key))
                        .onChange(async (value) => {
                            if (value) {
                                if (!this.plugin.settings.variant_style.includes(key)) {
                                    this.plugin.settings.variant_style.push(key);
                                }
                            } else {
                                this.plugin.settings.variant_style =
                                    this.plugin.settings.variant_style.filter((s) => s !== key);
                                if (this.plugin.settings.variant_style.length === 0) {
                                    this.plugin.settings.variant_style = ["wozniak_matuschak"];
                                    new Notice("Proteus: at least one style required");
                                }
                            }
                            await this.plugin.saveSettings();
                        }),
                );
        }
    }
}
