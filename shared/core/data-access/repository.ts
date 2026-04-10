/**
 * Generic repository interface for keyed data collections.
 *
 * Implementations:
 * - VaultTable (file-backed frontmatter via Obsidian vault)
 * - CodeBlockRepository (JSON arrays in markdown code blocks)
 */
export interface Repository<T> {
	get(id: string): T | undefined;
	has(id: string): boolean;
	getAll(): readonly T[];
	create(item: T): Promise<T>;
	update(id: string, patch: Partial<T>): Promise<T>;
	delete(id: string): Promise<void>;
}
