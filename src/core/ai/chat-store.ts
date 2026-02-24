import { normalizePath, type App, type Plugin } from "obsidian";
import { nanoid } from "nanoid";
import type { StoredChatMessage, ThreadData, ThreadMeta } from "./ai-service";

export class ChatStore {
	private readonly conversationsDir: string;
	private readonly indexPath: string;
	private index: ThreadMeta[] = [];

	constructor(
		private app: App,
		plugin: Plugin
	) {
		const pluginDir = plugin.manifest.dir!;
		this.conversationsDir = normalizePath(`${pluginDir}/conversations`);
		this.indexPath = normalizePath(`${this.conversationsDir}/index.json`);
	}

	async ensureDir(): Promise<void> {
		if (!(await this.app.vault.adapter.exists(this.conversationsDir))) {
			await this.app.vault.adapter.mkdir(this.conversationsDir);
		}
	}

	async loadIndex(): Promise<void> {
		try {
			const content = await this.app.vault.adapter.read(this.indexPath);
			const parsed = JSON.parse(content) as unknown;
			if (Array.isArray(parsed)) {
				this.index = parsed as ThreadMeta[];
			} else {
				this.index = [];
			}
		} catch {
			this.index = [];
		}
	}

	private async saveIndex(): Promise<void> {
		await this.ensureDir();
		await this.app.vault.adapter.write(this.indexPath, JSON.stringify(this.index));
	}

	getThreadList(): ThreadMeta[] {
		return [...this.index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}

	async loadThread(id: string): Promise<ThreadData | null> {
		try {
			const path = normalizePath(`${this.conversationsDir}/${id}.json`);
			const content = await this.app.vault.adapter.read(path);
			return JSON.parse(content) as ThreadData;
		} catch {
			return null;
		}
	}

	async saveThread(thread: ThreadData): Promise<void> {
		await this.ensureDir();
		const path = normalizePath(`${this.conversationsDir}/${thread.id}.json`);
		await this.app.vault.adapter.write(path, JSON.stringify(thread));

		const meta: ThreadMeta = {
			id: thread.id,
			title: thread.title,
			mode: thread.mode,
			createdAt: thread.createdAt,
			updatedAt: thread.updatedAt,
		};

		const existingIdx = this.index.findIndex((t) => t.id === thread.id);
		if (existingIdx >= 0) {
			this.index[existingIdx] = meta;
		} else {
			this.index.push(meta);
		}

		await this.saveIndex();
	}

	async deleteThread(id: string): Promise<void> {
		this.index = this.index.filter((t) => t.id !== id);
		await this.saveIndex();

		try {
			const path = normalizePath(`${this.conversationsDir}/${id}.json`);
			if (await this.app.vault.adapter.exists(path)) {
				await this.app.vault.adapter.remove(path);
			}
		} catch {
			// File already gone
		}
	}

	createThread(mode: string): ThreadData {
		const now = new Date().toISOString();
		return {
			id: nanoid(),
			title: "New conversation",
			mode,
			createdAt: now,
			updatedAt: now,
			messages: [],
		};
	}

	addMessage(thread: ThreadData, role: "user" | "assistant", content: string): StoredChatMessage {
		const msg: StoredChatMessage = {
			id: nanoid(),
			role,
			content,
			createdAt: new Date().toISOString(),
		};
		thread.messages.push(msg);
		thread.updatedAt = msg.createdAt;
		return msg;
	}
}
