/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Kinds of nodes in the declared, read-only workspace graph. */
export type GraphNodeKind = 'workspace' | 'solution' | 'solutionFolder' | 'project' | 'file' | 'dependency';

/** Severity for a diagnostic that makes a graph or project view partial. */
export type GraphDiagnosticSeverity = 'warning' | 'error';

/** A displayable graph node; URI values are serialized strings, not filesystem capabilities. */
export interface IGraphNode {
	readonly id: string;
	readonly kind: GraphNodeKind;
	readonly label: string;
	readonly resourceUri?: string;
	readonly parentId?: string;
	readonly childIds: readonly string[];
}

/** A stable diagnostic description attached to a graph resource when possible. */
export interface IGraphDiagnostic {
	readonly id: string;
	readonly code: string;
	readonly message: string;
	readonly severity: GraphDiagnosticSeverity;
	readonly resourceUri?: string;
}

/** Read-only graph snapshot shared by the future scanner, parsers, and tree provider. */
export interface IWorkspaceGraph {
	readonly rootIds: readonly string[];
	readonly nodes: readonly IGraphNode[];
	readonly diagnostics: readonly IGraphDiagnostic[];
}
