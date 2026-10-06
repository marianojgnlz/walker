/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { IKeyValueStorage, IExperimentationTelemetry, ExperimentationService as TASClient } from 'tas-client';
import { Memento } from '../../../common/memento.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ASSIGNMENT_REFETCH_INTERVAL, ASSIGNMENT_STORAGE_KEY, AssignmentFilterProvider, IAssignmentService, TargetPopulation, WindowKind } from '../../../../platform/assignment/common/assignment.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { resolveAmdNodeModulePath } from '../../../../amdX.js';
import { timeout } from '../../../../base/common/async.js';
import { CopilotAssignmentFilterProvider } from './assignmentFilters.js';
import { AssignmentContextFilter } from './assignmentContextFilter.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { experimentsEnabled } from './assignmentExperiments.js';
import { CancellationError } from '../../../../base/common/errors.js';

export interface IAssignmentFilter {
	/**
	 * Stable identifier for this filter. Used to persist and reconcile the set of
	 * assignment-context ids this filter has excluded, independently of other filters.
	 */
	readonly id: string;
	exclude(assignment: string): boolean;
	onDidChange: Event<void>;
}

export const IWorkbenchAssignmentService = createDecorator<IWorkbenchAssignmentService>('assignmentService');


export interface IWorkbenchAssignmentService extends IAssignmentService {
	getCurrentExperiments(): Promise<string[] | undefined>;
	addTelemetryAssignmentFilter(filter: IAssignmentFilter): void;
	/** Resolves the effective value without delaying developer overrides; assignment metadata always comes from TAS. */
	getTreatmentWithAssignment<T extends string | number | boolean>(name: string): Promise<ITreatmentWithAssignment<T>>;
}

export interface ITreatmentWithAssignment<T extends string | number | boolean> {
	readonly value: T | undefined;
	/** May remain pending after a developer override resolves; rejects on failure or cancellation, never conflating these with absence. */
	readonly hasAssignment: Promise<boolean>;
}

export async function resolveTreatmentWithAssignment<T extends string | number | boolean>(override: T | undefined, readAssignment: () => Promise<T | undefined>): Promise<ITreatmentWithAssignment<T>> {
	if (override !== undefined) {
		return { value: override, hasAssignment: readAssignment().then(value => value !== undefined) };
	}
	const value = await readAssignment();
	return { value, hasAssignment: Promise.resolve(value !== undefined) };
}

class MementoKeyValueStorage implements IKeyValueStorage {

	private readonly mementoObj: Record<string, unknown>;

	constructor(private readonly memento: Memento<Record<string, unknown>>) {
		this.mementoObj = memento.getMemento(StorageScope.APPLICATION, StorageTarget.MACHINE);
	}

	async getValue<T>(key: string, defaultValue?: T | undefined): Promise<T | undefined> {
		const value = await this.mementoObj[key] as T | undefined;

		return value || defaultValue;
	}

	setValue<T>(key: string, value: T): void {
		this.mementoObj[key] = value;
		this.memento.saveMemento();
	}
}

class AssignmentContextTracker extends Disposable implements IExperimentationTelemetry {

	private readonly _onDidUpdateAssignmentContext = this._register(new Emitter<void>());
	readonly onDidUpdateAssignmentContext = this._onDidUpdateAssignmentContext.event;

	private _previousAssignmentContext: string | undefined;
	private _lastAssignmentContext: string | undefined;
	get assignmentContext(): string[] | undefined {
		return this._lastAssignmentContext?.split(';');
	}

	constructor(
		private readonly productService: IProductService,
		private readonly contextFilter: AssignmentContextFilter
	) {
		super();

		// Re-apply the filters whenever a filter is added or changes its exclusion decisions.
		this._register(this.contextFilter.onDidChange(() => {
			if (this._previousAssignmentContext) {
				this._setAssignmentContext(this._previousAssignmentContext);
			}
		}));
	}

	private _setAssignmentContext(value: string): void {
		const filteredValue = this.contextFilter.filter(value);
		this._lastAssignmentContext = filteredValue;
		this._onDidUpdateAssignmentContext.fire();
	}

	/**
	 * The experiment client publishes its assignment context through this hook. Only the
	 * assignment context is tracked here: it drives the refetch signal and
	 * `getCurrentExperiments`, which are ordinary experiment features.
	 */
	setSharedProperty(name: string, value: string): void {
		if (name === this.productService.tasConfig?.assignmentContextTelemetryPropertyName) {
			this._previousAssignmentContext = value;
			this._setAssignmentContext(value);
		}
	}

	/**
	 * Deliberately inert. The experiment client requires the `IExperimentationTelemetry`
	 * shape, but its events must not become a reporting path.
	 */
	postEvent(eventName: string, props: Map<string, string>): void {
	}
}

export class WorkbenchAssignmentService extends Disposable implements IAssignmentService {

	declare readonly _serviceBrand: undefined;

	private tasClient: Promise<TASClient> | undefined;
	private readonly tasSetupDisposables = this._register(new DisposableStore());

	private networkInitialized = false;
	private setupGeneration = 0;
	/** Revokes the current setup's storage/telemetry/fetch wrappers, neutralizing a superseded in-flight client. */
	private revokeCurrentSetup: (() => void) | undefined;
	private readonly overrideInitDelay: Promise<void>;

	private readonly contextFilter: AssignmentContextFilter;
	private readonly contextTracker: AssignmentContextTracker;
	private readonly keyValueStorage: IKeyValueStorage;

	private readonly experimentsEnabled: boolean;

	private readonly _onDidRefetchAssignments = this._register(new Emitter<void>());
	public readonly onDidRefetchAssignments = this._onDidRefetchAssignments.event;

	constructor(
		@IStorageService storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IProductService private readonly productService: IProductService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this.experimentsEnabled = experimentsEnabled(configurationService, productService, this.environmentService);

		if (this.experimentsEnabled) {
			this.tasClient = this.setupTASClient();

			// Stop the final client's auto-polling and revoke its wrappers when the service is disposed.
			this._register(toDisposable(() => {
				this.revokeCurrentSetup?.();
				WorkbenchAssignmentService.disposeTasClient(this.tasClient);
			}));
		}

		this.contextFilter = this._register(new AssignmentContextFilter(storageService));
		this.contextTracker = this._register(new AssignmentContextTracker(productService, this.contextFilter));
		this._register(this.contextTracker.onDidUpdateAssignmentContext(() => this._onDidRefetchAssignments.fire()));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('experiments.override')) {
				this._onDidRefetchAssignments.fire();
			}
		}));

		this.keyValueStorage = new MementoKeyValueStorage(new Memento<Record<string, unknown>>('experiment.service.memento', storageService));

		// For development purposes, configure the delay until tas local tas treatment ovverrides are available
		const overrideDelaySetting = configurationService.getValue('experiments.overrideDelay');
		const overrideDelay = typeof overrideDelaySetting === 'number' ? overrideDelaySetting : 0;
		this.overrideInitDelay = timeout(overrideDelay);
	}

	async getTreatment<T extends string | number | boolean>(name: string): Promise<T | undefined> {
		return this.doGetTreatment<T>(name);
	}

	async getTreatmentWithAssignment<T extends string | number | boolean>(name: string): Promise<ITreatmentWithAssignment<T>> {
		await this.overrideInitDelay;
		const override = this.configurationService.getValue<T>(`experiments.override.${name}`);
		return resolveTreatmentWithAssignment(override, () => this.getAssignedTreatment<T>(name, true));
	}

	private async doGetTreatment<T extends string | number | boolean>(name: string): Promise<T | undefined> {
		await this.overrideInitDelay; // For development purposes, allow overriding tas assignments to test variants locally.

		const override = this.configurationService.getValue<T>(`experiments.override.${name}`);
		if (override !== undefined) {
			return override;
		}

		return this.getAssignedTreatment<T>(name, false);
	}

	private async getAssignedTreatment<T extends string | number | boolean>(name: string, requireCurrentClient: boolean): Promise<T | undefined> {
		if (!this.tasClient) {
			return undefined;
		}

		if (!this.experimentsEnabled) {
			return undefined;
		}

		for (let attempt = 0; attempt < 2; attempt++) {
			if (requireCurrentClient && this._store.isDisposed) {
				throw new CancellationError();
			}
			const clientPromise: Promise<TASClient> = this.tasClient;
			const client = await clientPromise;

			// Prefer cached treatments while the initial fetch is still pending.
			if (!this.networkInitialized) {
				await client.getTreatmentVariableAsync<T>('vscode', name, true);
			}
			// Assignment metadata must not outlive its client; legacy value-only reads retain their original contract.
			if (requireCurrentClient) {
				if (this._store.isDisposed) {
					throw new CancellationError();
				}
				if (clientPromise !== this.tasClient) {
					continue;
				}
			}
			return client.getTreatmentVariable<T>('vscode', name);
		}
		throw new CancellationError();
	}

	private async setupTASClient(): Promise<TASClient> {
		this.tasSetupDisposables.clear();

		// Each setup supersedes the previous client; track a generation so a stale client's
		// initialFetch cannot flip networkInitialized for a newer client.
		const generation = ++this.setupGeneration;
		this.networkInitialized = false;

		// Revoke the previous setup's wrappers, then dispose its client. Revoking neutralizes a
		// superseded, still-in-flight client: after replacement it can no longer write the shared
		// memento, emit telemetry, or hit the assignments endpoint. This is needed because the
		// tas-client's dispose() only stops its polling timer, not an already-running fetch.
		this.revokeCurrentSetup?.();
		WorkbenchAssignmentService.disposeTasClient(this.tasClient);

		let revoked = false;
		this.revokeCurrentSetup = () => { revoked = true; };

		// Reference the shared memento/telemetry/fetch lazily (at call time): they are assigned in
		// the constructor body after the initial setupTASClient() call has already started.
		const service = this;

		const keyValueStorage: IKeyValueStorage = {
			getValue<T>(key: string, defaultValue?: T): Promise<T | undefined> {
				return service.keyValueStorage.getValue<T>(key, defaultValue);
			},
			setValue<T>(key: string, value: T): void {
				if (!revoked) {
					service.keyValueStorage.setValue<T>(key, value);
				}
			},
		};

		const telemetry: IExperimentationTelemetry = {
			setSharedProperty(name: string, value: string): void {
				if (!revoked) {
					service.contextTracker.setSharedProperty(name, value);
				}
			},
			postEvent(eventName: string, props: Map<string, string>): void {
				if (!revoked) {
					service.contextTracker.postEvent(eventName, props);
				}
			},
		};

		const targetPopulation = this.productService.quality === 'stable' ?
			TargetPopulation.Public : (this.productService.quality === 'exploration' ?
				TargetPopulation.Exploration : TargetPopulation.Insiders);

		const filterProvider = new AssignmentFilterProvider(
			this.productService.version,
			this.productService.nameLong,
			targetPopulation,
			this.productService.date ?? '',
			this.environmentService.isSessionsWindow ? WindowKind.Agents : WindowKind.Editor
		);

		const extensionsFilterProvider = this.instantiationService.createInstance(CopilotAssignmentFilterProvider);
		this.tasSetupDisposables.add(extensionsFilterProvider);
		this.tasSetupDisposables.add(extensionsFilterProvider.onDidChangeFilters(() => this.refetchAssignments()));

		const tasConfig = this.productService.tasConfig!;

		// tas-client ships as pure ESM; load it via a runtime-resolved URL so bundlers do not
		// rewrite the import (mirrors how the editor loads the `@vscode/diff` module).
		const tasClientUrl = resolveAmdNodeModulePath('tas-client', 'dist/tas-client.min.js');
		const tasClientModule = await import(/* webpackIgnore: true */ /* @vite-ignore */ `${tasClientUrl}`) as typeof import('tas-client');

		const tasClient = new tasClientModule.ExperimentationService({
			filterProviders: [filterProvider, extensionsFilterProvider],
			telemetry,
			storageKey: ASSIGNMENT_STORAGE_KEY,
			keyValueStorage,
			assignmentContextTelemetryPropertyName: tasConfig.assignmentContextTelemetryPropertyName,
			telemetryEventName: tasConfig.telemetryEventName,
			endpoint: tasConfig.endpoint,
			extensionName: 'vscode-core',
			refetchInterval: ASSIGNMENT_REFETCH_INTERVAL,
		});

		await tasClient.initializePromise;
		tasClient.initialFetch.then(() => {
			if (generation !== this.setupGeneration) {
				return; // superseded by a newer setup
			}
			this.networkInitialized = true;
		}).catch(() => undefined);

		return tasClient;
	}

	private async refetchAssignments(): Promise<void> {
		if (!this.tasClient) {
			return; // Setup has not started, assignments will use latest filters
		}

		// Await the client to be setup and the initial fetch to complete
		const tasClient = await this.tasClient;
		await tasClient.initialFetch;

		// Refresh the assignments
		await tasClient.getTreatmentVariableAsync('vscode', 'refresh', false);
	}

	async getCurrentExperiments(): Promise<string[] | undefined> {
		if (!this.tasClient) {
			return undefined;
		}

		if (!this.experimentsEnabled) {
			return undefined;
		}

		await this.tasClient;

		return this.contextTracker.assignmentContext;
	}

	addTelemetryAssignmentFilter(filter: IAssignmentFilter): void {
		this.contextFilter.addFilter(filter);
	}

	/** Stops a TAS client's auto-polling once it resolves. Safe to call with `undefined`. */
	private static disposeTasClient(client: Promise<TASClient> | undefined): void {
		client?.then(c => c.dispose()).catch(() => undefined);
	}
}

registerSingleton(IWorkbenchAssignmentService, WorkbenchAssignmentService, InstantiationType.Delayed);

const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
registry.registerConfiguration({
	...workbenchConfigurationNodeBase,
	'properties': {
		'workbench.enableExperiments': {
			'type': 'boolean',
			'description': localize('workbench.enableExperiments', "Fetches experiments to run from a Microsoft online service."),
			'default': true,
			'scope': ConfigurationScope.APPLICATION,
			'restricted': true,
			'tags': ['usesOnlineServices']
		}
	}
});
