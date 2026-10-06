/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { GitHubService, IGitHubService } from '../../../../platform/github/common/githubService.js';
import { IGitHubEndpointProvider, IGitHubTokenProvider } from '../../../../platform/github/common/githubTypes.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';

class WorkbenchGitHubEndpointProvider implements IGitHubEndpointProvider {

	readonly onDidChange = Event.None;

	getApiBaseUri(): string {
		return 'https://api.github.com';
	}

	getGraphQlUri(): string {
		return 'https://api.github.com/graphql';
	}
}

export class WorkbenchGitHubTokenProvider implements IGitHubTokenProvider {

	readonly onDidChangeToken = Event.None;

	async getToken(_signal: AbortSignal): Promise<string | undefined> {
		return undefined;
	}
}

export class WorkbenchGitHubService extends GitHubService {

	constructor(@ILogService logService: ILogService) {
		super({
			endpoint: new WorkbenchGitHubEndpointProvider(),
			tokenProvider: new WorkbenchGitHubTokenProvider(),
		}, logService);
	}
}

registerSingleton(IGitHubService, WorkbenchGitHubService, InstantiationType.Delayed);
