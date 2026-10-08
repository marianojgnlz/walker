/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const SOLUTION_EXPLORER_COMMANDS = Object.freeze({
	open: 'walker.solutionExplorer.open',
	openExternal: 'walker.solutionExplorer.openExternal',
	refresh: 'walker.solutionExplorer.refresh',
	configureEditing: 'walker.solutionExplorer.configureEditing',
});

export interface ISolutionNavigationTarget {
	readonly kind: string;
	readonly resourceUri?: string;
	readonly displayOnly?: boolean;
	readonly navigable?: boolean;
}

export interface ISolutionNavigationDisposable {
	dispose(): void;
}

/** Injected host: the only operation is the regular editor-open command, never file inspection. */
export interface ISolutionNavigationHost {
	readonly uiKind: 'desktop' | 'web';
	readonly extensionKind: 'ui' | 'workspace' | undefined;
	readonly remoteName: string | undefined;
	registerCommand(id: string, handler: (...args: readonly unknown[]) => Promise<boolean>): ISolutionNavigationDisposable;
	openDocument(resourceUri: string): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isNavigationTarget(value: unknown): value is ISolutionNavigationTarget {
	return isRecord(value)
		&& typeof value.kind === 'string'
		&& (value.resourceUri === undefined || typeof value.resourceUri === 'string')
		&& (value.displayOnly === undefined || typeof value.displayOnly === 'boolean')
		&& (value.navigable === undefined || typeof value.navigable === 'boolean');
}

function normalizeTarget(value: unknown): ISolutionNavigationTarget | undefined {
	if (isNavigationTarget(value)) { return value; }
	if (!isRecord(value) || value.kind !== 'graph' || !isNavigationTarget(value.node)) { return undefined; }
	return value.node;
}

function isLocalFileUri(value: string): boolean {
	try {
		const uri = new URL(value);
		return uri.protocol === 'file:'
			&& (uri.hostname === '' || uri.hostname.toLowerCase() === 'localhost')
			&& uri.username.length === 0
			&& uri.password.length === 0
			&& uri.pathname.length > 0
			&& uri.search.length === 0
			&& uri.hash.length === 0;
	} catch {
		return false;
	}
}

function supportsLocalNavigation(host: ISolutionNavigationHost): boolean {
	return host.uiKind === 'desktop' && host.extensionKind === 'ui' && host.remoteName === undefined;
}

function canOpenNormally(target: ISolutionNavigationTarget): boolean {
	if (target.kind === 'workspace' || target.kind === 'solutionFolder' || target.kind === 'diagnostic' || target.kind === 'status') { return false; }
	if (target.displayOnly === true || target.navigable === false) { return false; }
	return target.kind !== 'dependency' || target.navigable === true;
}

function canOpenExplicitly(target: ISolutionNavigationTarget): boolean {
	return target.displayOnly === true && target.kind !== 'workspace' && target.kind !== 'diagnostic' && target.kind !== 'status';
}

/** Registers normal local navigation and a separate explicit action for display-only references. */
export function createSolutionNavigationController(host: ISolutionNavigationHost): ISolutionNavigationDisposable {
	const registrations: ISolutionNavigationDisposable[] = [];
	let disposed = false;
	const register = (id: string, action: (target: ISolutionNavigationTarget) => Promise<boolean>): void => {
		const registration = host.registerCommand(id, async (...args) => {
			if (disposed || args.length !== 1 || !supportsLocalNavigation(host)) { return false; }
			const target = normalizeTarget(args[0]);
			if (!target) { return false; }
			const resourceUri = target.resourceUri;
			if (!resourceUri || !isLocalFileUri(resourceUri)) { return false; }
			return action(target);
		});
		registrations.push(registration);
	};

	register(SOLUTION_EXPLORER_COMMANDS.open, async target => {
		if (!canOpenNormally(target) || !target.resourceUri) { return false; }
		await host.openDocument(target.resourceUri);
		return true;
	});
	register(SOLUTION_EXPLORER_COMMANDS.openExternal, async target => {
		if (!canOpenExplicitly(target) || !target.resourceUri) { return false; }
		await host.openDocument(target.resourceUri);
		return true;
	});

	return {
		dispose: () => {
			if (disposed) { return; }
			disposed = true;
			for (const registration of registrations.splice(0).reverse()) { registration.dispose(); }
		},
	};
}
