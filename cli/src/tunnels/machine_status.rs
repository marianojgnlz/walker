/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::sync::{
	atomic::{AtomicBool, Ordering},
	Arc, OnceLock, RwLock,
};

use serde::{Deserialize, Serialize};

const STATUS_PREFIX: &str = "__VSCODE_CLI_STATUS__";

/// A machine-readable CLI status event that can be relayed to attached
/// clients without parsing the human-readable log stream.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(
	tag = "type",
	rename_all = "camelCase",
	rename_all_fields = "camelCase"
)]
pub(crate) enum MachineStatus {
	TokenError {
		message: String,
	},
}

type MachineStatusSink = Arc<dyn Fn(&MachineStatus) + Send + Sync>;

static STATUS_SINK: OnceLock<RwLock<Option<MachineStatusSink>>> = OnceLock::new();
static STDOUT_ENABLED: AtomicBool = AtomicBool::new(false);

fn status_sink() -> &'static RwLock<Option<MachineStatusSink>> {
	STATUS_SINK.get_or_init(|| RwLock::new(None))
}

#[cfg(test)]
static TEST_STDOUT_SINK: OnceLock<RwLock<Option<MachineStatusSink>>> = OnceLock::new();

#[cfg(test)]
fn test_stdout_sink() -> &'static RwLock<Option<MachineStatusSink>> {
	TEST_STDOUT_SINK.get_or_init(|| RwLock::new(None))
}

fn status_line(status: &MachineStatus) -> String {
	format!(
		"{STATUS_PREFIX}{}",
		serde_json::to_string(status).expect("status must serialize")
	)
}

/// Installs a process-wide relay so status events raised by long-lived tunnel
/// services can reach singleton clients that own separate stdout streams.
pub(crate) fn install_sink(sink: impl Fn(&MachineStatus) + Send + Sync + 'static) {
	*status_sink().write().unwrap() = Some(Arc::new(sink));
}

/// Controls local stdout output independently from relaying so attached clients
/// can receive events from servers that were not started for machine consumers.
pub(crate) fn set_stdout_enabled(enabled: bool) {
	STDOUT_ENABLED.store(enabled, Ordering::Relaxed);
}

/// Emits a received or locally-created status event to every enabled process
/// destination, preserving relay delivery when local stdout is disabled.
pub(crate) fn emit(status: MachineStatus) {
	let sink = status_sink().read().unwrap().clone();
	if let Some(sink) = sink {
		sink(&status);
	}
	if STDOUT_ENABLED.load(Ordering::Relaxed) {
		emit_to_stdout(&status);
	}
}

fn emit_to_stdout(status: &MachineStatus) {
	#[cfg(test)]
	if let Some(sink) = test_stdout_sink().read().unwrap().clone() {
		sink(status);
		return;
	}

	println!("{}", status_line(status));
}

pub fn emit_token_error(message: String) {
	emit(MachineStatus::TokenError { message });
}

#[cfg(test)]
mod tests {
	use std::sync::{atomic::Ordering, Arc, Mutex};

	use crate::{
		json_rpc::JsonRpcSerializer, rpc::RpcCaller,
		tunnels::protocol::singleton::METHOD_MACHINE_STATUS,
	};

	use super::{
		emit_token_error, install_sink, set_stdout_enabled, status_line, status_sink,
		test_stdout_sink, MachineStatus, STDOUT_ENABLED,
	};

	static STATUS_TEST_LOCK: Mutex<()> = Mutex::new(());

	struct ResetMachineStatus;

	impl Drop for ResetMachineStatus {
		fn drop(&mut self) {
			*status_sink().write().unwrap() = None;
			*test_stdout_sink().write().unwrap() = None;
			STDOUT_ENABLED.store(false, Ordering::Relaxed);
		}
	}

	#[test]
	fn serializes_token_error() {
		assert_eq!(
			status_line(&MachineStatus::TokenError {
				message: "refresh token expired".to_string(),
			}),
			"__VSCODE_CLI_STATUS__{\"type\":\"tokenError\",\"message\":\"refresh token expired\"}"
		);
	}

	#[test]
	fn relays_token_errors_when_stdout_is_disabled() {
		let _lock = STATUS_TEST_LOCK.lock().unwrap();
		let _reset = ResetMachineStatus;
		set_stdout_enabled(false);
		let received = Arc::new(Mutex::new(Vec::new()));
		let sink_received = received.clone();
		install_sink(move |status| sink_received.lock().unwrap().push(status.clone()));

		emit_token_error("refresh token expired".to_string());

		assert_eq!(
			*received.lock().unwrap(),
			vec![MachineStatus::TokenError {
				message: "refresh token expired".to_string(),
			}]
		);
	}

	#[test]
	fn relays_and_writes_token_errors_when_stdout_is_enabled() {
		let _lock = STATUS_TEST_LOCK.lock().unwrap();
		let _reset = ResetMachineStatus;
		set_stdout_enabled(true);
		let relayed = Arc::new(Mutex::new(Vec::new()));
		let relayed_statuses = relayed.clone();
		install_sink(move |status| relayed_statuses.lock().unwrap().push(status.clone()));
		let written = Arc::new(Mutex::new(Vec::new()));
		let written_statuses = written.clone();
		*test_stdout_sink().write().unwrap() = Some(Arc::new(move |status| {
			written_statuses.lock().unwrap().push(status.clone())
		}));

		emit_token_error("refresh token expired".to_string());

		let expected = vec![MachineStatus::TokenError {
			message: "refresh token expired".to_string(),
		}];
		assert_eq!(*relayed.lock().unwrap(), expected);
		assert_eq!(
			*written.lock().unwrap(),
			vec![MachineStatus::TokenError {
				message: "refresh token expired".to_string(),
			}]
		);
	}

	#[test]
	fn machine_status_notification_round_trips() {
		let expected = MachineStatus::TokenError {
			message: "refresh token expired".to_string(),
		};
		let serialized =
			RpcCaller::serialize_notify(&JsonRpcSerializer {}, METHOD_MACHINE_STATUS, &expected);
		let notification: serde_json::Value = serde_json::from_slice(&serialized).unwrap();

		assert_eq!(notification["method"], METHOD_MACHINE_STATUS);
		let deserialized: MachineStatus =
			serde_json::from_value(notification["params"].clone()).unwrap();
		assert_eq!(deserialized, expected);
	}
}
