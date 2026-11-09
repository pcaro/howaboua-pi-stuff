import { randomUUID } from "node:crypto";
import {
	type Api,
	getSupportedThinkingLevels,
	type Message,
	type Model,
	type ModelThinkingLevel,
} from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readInstructions, type SuggestionConfig } from "./config.js";
import { type ConversationSnapshot, conversationUpdate } from "./context.js";
import { cleanupSessionResources } from "./session-resources.js";

const instruction =
	"Draft one concise next request from the user to the assistant. Output only the request.";

function modelRef(model: Model<Api>): string {
	return `${model.provider}/${model.id}`;
}

interface PredictionSession {
	id: string;
	model: string;
	window: string;
	instructions: string;
	seen: string[];
	messages: Message[];
}

/** Private, append-only model conversation; never written into the user's chat. */
export class Predictions {
	private session: PredictionSession | undefined;

	reset(): void {
		const previous = this.session;
		this.session = undefined;
		if (previous) cleanupSessionResources(previous.id);
	}

	sync(snapshot: ConversationSnapshot): void {
		const current = this.session;
		if (
			current &&
			(current.window !== snapshot.window ||
				current.seen.some((key, index) => snapshot.turns[index]?.key !== key))
		)
			this.reset();
	}

	/** Tries the selected model, then `fallbackModels`, then the session model; each failure moves on. */
	async predict(
		ctx: ExtensionContext,
		selection: NonNullable<SuggestionConfig["model"]>,
		fallbackModels: readonly string[],
		snapshot: ConversationSnapshot,
		signal: AbortSignal,
	): Promise<{ text: string; commit(): void } | undefined> {
		this.sync(snapshot);
		const instructions = readInstructions().trim();
		if (this.session && this.session.instructions !== instructions)
			this.reset();
		const available = ctx.modelRegistry.getAvailable();
		const models: Model<Api>[] = [];
		for (const model of [
			...[`${selection.provider}/${selection.id}`, ...fallbackModels].map(
				(ref) => available.find((model) => modelRef(model) === ref),
			),
			ctx.model,
		])
			if (model && !models.some((seen) => modelRef(seen) === modelRef(model)))
				models.push(model);
		if (models.length === 0)
			throw new Error("No suggestion model is available.");
		for (const [index, model] of models.entries()) {
			try {
				return await this.request(
					ctx,
					model,
					selection.reasoning,
					instructions,
					snapshot,
					signal,
				);
			} catch (error) {
				if (signal.aborted || index === models.length - 1) throw error;
			}
		}
	}

	private async request(
		ctx: ExtensionContext,
		model: Model<Api>,
		reasoning: ModelThinkingLevel,
		instructions: string,
		snapshot: ConversationSnapshot,
		signal: AbortSignal,
	): Promise<{ text: string; commit(): void } | undefined> {
		// Provider replies continue only on the model that produced them.
		if (this.session && this.session.model !== modelRef(model)) this.reset();
		const session = (this.session ??= {
			id: randomUUID(),
			model: modelRef(model),
			window: snapshot.window,
			instructions,
			seen: [],
			messages: [],
		});
		if (session.seen.length === snapshot.turns.length) return undefined;
		const update: Message = {
			role: "user",
			content: conversationUpdate(snapshot, session.seen.length),
			timestamp: Date.now(),
		};
		const reply = await ctx.modelRegistry
			.streamSimple(
				model,
				{
					systemPrompt: [instruction, instructions]
						.filter(Boolean)
						.join("\n\n"),
					messages: [...session.messages, update],
				},
				{
					signal,
					...(reasoning === "off" ||
					!getSupportedThinkingLevels(model).includes(reasoning)
						? {}
						: { reasoning }),
					maxTokens: 1024,
					cacheRetention: "short",
					sessionId: session.id,
				},
			)
			.result();
		if (signal.aborted) return undefined;
		if (reply.stopReason === "error" || reply.stopReason === "aborted")
			throw new Error("The suggestion request did not complete.");
		if (
			reply.stopReason !== "stop" ||
			reply.content.some((part) => part.type === "toolCall")
		)
			return undefined;
		const final = reply.content.findLast(
			(part) => part.type === "text" && part.text.trim(),
		);
		const text =
			final?.type === "text" ? final.text.trim().replace(/\s+/gu, " ") : "";
		if (!text || /\p{Cc}/u.test(text)) return undefined;
		return {
			text,
			commit: () => {
				if (this.session !== session || signal.aborted) return;
				// Preserve provider reply metadata and thinking for exact continuation.
				session.messages.push(update, reply);
				session.seen = snapshot.turns.map((turn) => turn.key);
			},
		};
	}
}
