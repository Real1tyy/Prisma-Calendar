import { z } from "zod";

import { LocalKV, type KVBackend } from "../storage/local-kv";

/** Scope the id lives under inside the caller's namespace. */
const DEVICE_SCOPE = "device";
/** Length of the segment appended to a log file name. */
export const DEVICE_ID_LENGTH = 8;
const DeviceIdSchema = z.string().regex(/^[0-9a-f]{8}$/);

export interface DeviceLogIdOptions {
	/** Convention: `"<plugin-id>:logging"`. */
	namespace: string;
	backend?: KVBackend;
	/** Injected under test; production draws from `crypto.randomUUID`. */
	mint?: () => string;
}

function mintDeviceId(): string {
	return crypto.randomUUID().replaceAll("-", "").slice(0, DEVICE_ID_LENGTH);
}

/**
 * The id that keeps one device's log files from colliding with another's.
 *
 * Minted once per device and kept in device-local storage, never in the vault
 * — a vault-stored id would ride the sync tool to every other device and
 * defeat the whole point. It is random rather than derived from anything
 * about the machine: nothing else depends on its value, so an identifier
 * carrying no user information is the cheaper choice. This is the one place
 * randomness is legitimate near a writer, because a log file is device-local
 * diagnostic output, not synced vault data
 * ([[decision-deterministic-automatic-writes-across-synced-devices]]).
 */
export function resolveDeviceLogId(options: DeviceLogIdOptions): string {
	const kv = new LocalKV<string>({
		namespace: options.namespace,
		schema: DeviceIdSchema,
		...(options.backend ? { backend: options.backend } : {}),
	});
	const stored = kv.get(DEVICE_SCOPE);
	if (stored !== null) return stored;
	const minted = (options.mint ?? mintDeviceId)();
	kv.set(DEVICE_SCOPE, minted);
	return minted;
}
