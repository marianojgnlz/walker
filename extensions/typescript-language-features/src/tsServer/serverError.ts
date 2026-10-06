/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as Proto from './protocol/protocol';
import { TypeScriptVersion } from './versionProvider';


export class TypeScriptServerError extends Error {
	public static create(
		serverId: string,
		version: TypeScriptVersion,
		response: Proto.Response
	): TypeScriptServerError {
		const parsedResult = TypeScriptServerError.parseErrorText(response);
		return new TypeScriptServerError(serverId, version, response, parsedResult?.message, parsedResult?.stack);
	}

	private constructor(
		public readonly serverId: string,
		public readonly version: TypeScriptVersion,
		private readonly response: Proto.Response,
		public readonly serverMessage: string | undefined,
		public readonly serverStack: string | undefined
	) {
		super([
			`<${serverId}> TypeScript Server Error (${version.displayName})`,
			serverMessage,
			serverStack
		].filter(Boolean).join('\n'));
	}

	public get serverErrorText() { return this.response.message; }

	public get serverCommand() { return this.response.command; }

	/**
	 * Given a `errorText` from a tsserver request indicating failure in handling a request,
	 * splits it into the error message and the server stack.
	 */
	private static parseErrorText(response: Proto.Response) {
		const errorText = response.message;
		if (errorText) {
			const errorPrefix = 'Error processing request. ';
			if (errorText.startsWith(errorPrefix)) {
				const prefixFreeErrorText = errorText.substr(errorPrefix.length);
				const newlineIndex = prefixFreeErrorText.indexOf('\n');
				if (newlineIndex >= 0) {
					// Newline expected between message and stack.
					const stack = prefixFreeErrorText.substring(newlineIndex + 1);
					return {
						message: prefixFreeErrorText.substring(0, newlineIndex),
						stack
					};
				}
			}
		}
		return undefined;
	}

}
