import { Button, openReactModal, OutboundLink } from "@real1ty/obsidian-plugins-react";
import type { App } from "obsidian";
import { memo } from "react";

import { cls, CSS_PREFIX, docsUrl, tid } from "../../../constants";
import type { DeviceRole } from "../../../core/device-role-store";

export interface DeviceRoleControllerProps {
	onSelect: (role: DeviceRole) => void;
}

export const DeviceRoleController = memo(function DeviceRoleController({ onSelect }: DeviceRoleControllerProps) {
	return (
		<div className={cls("device-role-content")}>
			<h2>Choose this device's role</h2>
			<p>
				Choose Writer if this is your only device, or your primary device—the one you use most. You can also use Writer
				on every device when you do not keep the same vault open simultaneously. If concurrent use causes conflicts,
				make the other devices Readers.
			</p>
			<div className={cls("first-launch-mode-grid")}>
				<section className={cls("first-launch-mode-card")}>
					<span className={cls("first-launch-mode-title")}>Writer</span>
					<span className={cls("first-launch-mode-desc")}>
						Performs Prisma's automatic writes. Choose the device you use most for creating and editing events.
					</span>
					<Button testId={tid("device-role-writer")} variant="primary" onClick={() => onSelect("writer")}>
						Use as Writer
					</Button>
				</section>
				<section className={cls("first-launch-mode-card")}>
					<span className={cls("first-launch-mode-title")}>Reader</span>
					<span className={cls("first-launch-mode-desc")}>
						Shows synchronized notes but performs no automatic writes. Manual actions still work.
					</span>
					<Button testId={tid("device-role-reader")} onClick={() => onSelect("reader")}>
						Use as Reader
					</Button>
				</section>
			</div>
			<div className={cls("device-role-warning")}>
				<strong>Why this matters</strong>
				<p>
					Current Prisma versions derive recurring-event and integration IDs deterministically. Conflicts can still
					occur when devices use different settings or versions, templates insert device-specific values, or the same
					note is edited concurrently. The risk is substantially reduced when the vault is not open on several devices.
				</p>
				<OutboundLink href={docsUrl("/features/advanced/multi-device-sync")} className={cls("device-role-docs-link")}>
					Multiple devices and sync
				</OutboundLink>
			</div>
			<p className={cls("device-role-footnote")}>
				You can change this later in Settings → General. Closing this window keeps Prisma in safe Reader mode and asks
				again next startup.
			</p>
		</div>
	);
});

export function openDeviceRoleModal(app: App): Promise<DeviceRole | null> {
	return openReactModal<DeviceRole>({
		app,
		cls: cls("device-role-modal"),
		testId: tid("device-role-modal"),
		cssPrefix: CSS_PREFIX,
		testIdPrefix: CSS_PREFIX,
		render: (submit) => <DeviceRoleController onSelect={submit} />,
	});
}
