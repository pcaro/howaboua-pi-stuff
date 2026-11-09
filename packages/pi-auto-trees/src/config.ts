import fs from "node:fs";
import path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const CONFIG_FILENAME = "pi-auto-trees.json";
const DEFAULT_SUMMARY_CONFIG = {
	enabled: true,
	model: "openai-codex/gpt-6-luna",
	thinking: "low",
} as const;

const ALLOWED_THINKING = new Set([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
] as const);

type SummaryThinking =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh"
	| "max";

export interface SummaryModelConfig {
	enabled: boolean;
	/** Ordered `provider/id` refs; the session model follows the last one. */
	models: string[];
	thinking: SummaryThinking;
}

interface AutoTreesConfig {
	summary?: {
		enabled?: boolean;
		model?: string | string[];
		thinking?: SummaryThinking;
	};
}

function getConfigPath(): string {
	return path.join(getAgentDir(), CONFIG_FILENAME);
}

export function ensureConfigFile(): string {
	const configPath = getConfigPath();
	fs.mkdirSync(path.dirname(configPath), { recursive: true });
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(
			configPath,
			`${JSON.stringify({ summary: DEFAULT_SUMMARY_CONFIG }, null, 2)}\n`,
			"utf8",
		);
	}
	return configPath;
}

export function readSummaryConfig(): SummaryModelConfig {
	const configPath = ensureConfigFile();
	let parsed: AutoTreesConfig;
	try {
		parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as AutoTreesConfig;
	} catch (error) {
		throw new Error(
			`Could not parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const configured = parsed.summary;
	const models = [configured?.model ?? []]
		.flat()
		.filter((ref): ref is string => typeof ref === "string" && !!ref.trim())
		.map((ref) => ref.trim());
	const thinking =
		configured?.thinking && ALLOWED_THINKING.has(configured.thinking)
			? configured.thinking
			: DEFAULT_SUMMARY_CONFIG.thinking;

	return {
		enabled:
			typeof configured?.enabled === "boolean"
				? configured.enabled
				: DEFAULT_SUMMARY_CONFIG.enabled,
		models: models.length ? models : [DEFAULT_SUMMARY_CONFIG.model],
		thinking,
	};
}
