//! WormholeClient - Native bindings to magic-wormhole-rs
//!
//! Provides async file transfer capabilities via the Magic Wormhole protocol.

use crate::error::WormholeError;
use crate::types::{ProgressEvent, ReceiveOffer};
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use magic_wormhole::{
    transfer::{self, ReceiveRequestV1, AppVersion},
    transit::{Abilities, RelayHint, TransitInfo},
    MailboxConnection, Wormhole,
};

/// Default relay server URL
const DEFAULT_RELAY_SERVER: &str = "wss://relay.magic-wormhole.io:443/v1";

/// Internal state for an active wormhole session
enum SessionState {
    /// No active session
    Idle,
    /// Have a mailbox connection, waiting for sendFile() to connect
    MailboxReady {
        mailbox: MailboxConnection<AppVersion>,
        relay_hints: Vec<RelayHint>,
    },
    /// Connected wormhole, ready for transfer
    Connected {
        wormhole: Wormhole,
        relay_hints: Vec<RelayHint>,
    },
    /// Receiving: have a receive request, waiting for accept/reject
    Receiving {
        request: ReceiveRequestV1,
        relay_hints: Vec<RelayHint>,
    },
}

/// Native Magic Wormhole client for Electron
#[napi]
pub struct WormholeClient {
    state: Arc<Mutex<SessionState>>,
}

#[napi]
impl WormholeClient {
    /// Create a new WormholeClient instance
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(SessionState::Idle)),
        }
    }

    /// Generate a wormhole code for sending a file
    /// Returns the code immediately after connecting to the mailbox server.
    /// The actual PAKE exchange happens when sendFile() is called.
    #[napi]
    pub async fn create_send_code(&self, code_length: Option<u32>) -> Result<String> {
        let code_length = code_length.unwrap_or(2) as usize;

        // Create relay hints
        let relay_hints = vec![RelayHint::from_urls(None, [DEFAULT_RELAY_SERVER.parse().unwrap()])
            .map_err(|e| WormholeError::ConnectionFailed(e.to_string()))?];

        // Connect to mailbox server and allocate code
        let mailbox = MailboxConnection::create(transfer::APP_CONFIG, code_length)
            .await
            .map_err(|e| WormholeError::ConnectionFailed(e.to_string()))?;

        // Get the code before storing mailbox
        let code = mailbox.code().to_string();

        // Store the mailbox for later use (Wormhole::connect happens in sendFile)
        let mut state = self.state.lock().await;
        *state = SessionState::MailboxReady {
            mailbox,
            relay_hints,
        };

        Ok(code)
    }

    /// Send a file after code has been generated
    /// This connects to the receiver (PAKE exchange) and then sends the file.
    /// The progress callback receives ProgressEvent updates.
    #[napi]
    pub async fn send_file(
        &self,
        file_path: String,
        #[napi(ts_arg_type = "(err: null | Error, progress: ProgressEvent) => void")]
        progress_callback: ThreadsafeFunction<ProgressEvent>,
    ) -> Result<()> {
        let path = PathBuf::from(&file_path);

        if !path.exists() {
            return Err(WormholeError::FileNotFound(file_path).into());
        }

        // Take ownership of mailbox from state
        let (mailbox, relay_hints) = {
            let mut state = self.state.lock().await;
            match std::mem::replace(&mut *state, SessionState::Idle) {
                SessionState::MailboxReady {
                    mailbox,
                    relay_hints,
                } => (mailbox, relay_hints),
                SessionState::Connected { .. } => {
                    return Err(WormholeError::NoActiveSession.into());
                }
                _ => return Err(WormholeError::NoActiveSession.into()),
            }
        };

        // Now do the PAKE exchange - this waits for the receiver
        let wormhole = Wormhole::connect(mailbox)
            .await
            .map_err(|e| WormholeError::ConnectionFailed(e.to_string()))?;

        // Get file name
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string();

        // Create the offer
        let offer = transfer::offer::OfferSend::new_file_or_folder(file_name, path.clone())
            .await
            .map_err(|e| WormholeError::TransferFailed(e.to_string()))?;

        // Get total size for progress
        let total_size = offer.total_size();

        // Transit handler (logs connection info)
        let transit_handler = |info: TransitInfo| {
            tracing::info!("Transit: {}", info);
        };

        // Progress handler - use Arc to share callback
        let progress_cb = Arc::new(progress_callback);
        let progress_cb_clone = progress_cb.clone();
        let progress_handler = move |sent: u64, total: u64| {
            let event = ProgressEvent::new(sent, total);
            progress_cb_clone.call(Ok(event), ThreadsafeFunctionCallMode::NonBlocking);
        };

        // Send the file
        transfer::send(
            wormhole,
            relay_hints,
            Abilities::ALL,
            offer,
            &transit_handler,
            progress_handler,
            futures::future::pending::<()>(), // No cancellation for now
        )
        .await
        .map_err(|e| WormholeError::TransferFailed(e.to_string()))?;

        // Send 100% completion
        progress_cb.call(
            Ok(ProgressEvent::new(total_size, total_size)),
            ThreadsafeFunctionCallMode::NonBlocking,
        );

        Ok(())
    }

    /// Connect to receive a file using the given code
    /// Returns information about the offered file
    #[napi]
    pub async fn connect_receive(&self, code: String) -> Result<ReceiveOffer> {
        // Parse the code
        let wormhole_code: magic_wormhole::Code = code
            .parse()
            .map_err(|_| WormholeError::InvalidCode(code.clone()))?;

        // Create relay hints
        let relay_hints = vec![RelayHint::from_urls(None, [DEFAULT_RELAY_SERVER.parse().unwrap()])
            .map_err(|e| WormholeError::ConnectionFailed(e.to_string()))?];

        // Connect to mailbox
        let mailbox = MailboxConnection::connect(transfer::APP_CONFIG, wormhole_code, true)
            .await
            .map_err(|e| WormholeError::ConnectionFailed(e.to_string()))?;

        // Create wormhole
        let wormhole = Wormhole::connect(mailbox)
            .await
            .map_err(|e| WormholeError::ConnectionFailed(e.to_string()))?;

        // Request file transfer
        let request = transfer::request_file(
            wormhole,
            relay_hints.clone(),
            Abilities::ALL,
            futures::future::pending::<()>(), // No cancellation for now
        )
        .await
        .map_err(|e| WormholeError::TransferFailed(e.to_string()))?;

        // Handle None case (cancelled)
        let request = request.ok_or_else(|| WormholeError::Cancelled)?;

        // Extract file info
        let filename = request.file_name().to_string();
        let filesize = request.file_size();

        // Store the request for accept/reject
        let mut state = self.state.lock().await;
        *state = SessionState::Receiving {
            request,
            relay_hints,
        };

        Ok(ReceiveOffer::new(filename, filesize))
    }

    /// Accept the incoming file transfer
    /// Returns the path to the saved file
    #[napi]
    pub async fn accept_transfer(
        &self,
        output_dir: String,
        #[napi(ts_arg_type = "(err: null | Error, progress: ProgressEvent) => void")]
        progress_callback: ThreadsafeFunction<ProgressEvent>,
    ) -> Result<String> {
        // Take ownership of request from state
        let (request, _relay_hints) = {
            let mut state = self.state.lock().await;
            match std::mem::replace(&mut *state, SessionState::Idle) {
                SessionState::Receiving {
                    request,
                    relay_hints,
                } => (request, relay_hints),
                _ => return Err(WormholeError::NoActiveSession.into()),
            }
        };

        let filename = request.file_name().to_string();
        let filesize = request.file_size();
        let output_path = PathBuf::from(&output_dir).join(&filename);

        // Create output file
        let mut file = async_std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&output_path)
            .await
            .map_err(|e| WormholeError::IoError(e.to_string()))?;

        // Transit handler
        let transit_handler = |info: TransitInfo| {
            tracing::info!("Transit: {}", info);
        };

        // Progress handler - use Arc to share callback
        let progress_cb = Arc::new(progress_callback);
        let progress_cb_clone = progress_cb.clone();
        let progress_handler = move |received: u64, total: u64| {
            let event = ProgressEvent::new(received, total);
            progress_cb_clone.call(Ok(event), ThreadsafeFunctionCallMode::NonBlocking);
        };

        // Accept and receive the file
        request
            .accept(
                &transit_handler,
                progress_handler,
                &mut file,
                futures::future::pending::<()>(), // No cancellation for now
            )
            .await
            .map_err(|e| WormholeError::TransferFailed(e.to_string()))?;

        // Send 100% completion
        progress_cb.call(
            Ok(ProgressEvent::new(filesize, filesize)),
            ThreadsafeFunctionCallMode::NonBlocking,
        );

        Ok(output_path.to_string_lossy().to_string())
    }

    /// Reject the incoming file transfer
    #[napi]
    pub async fn reject_transfer(&self) -> Result<()> {
        let mut state = self.state.lock().await;
        match std::mem::replace(&mut *state, SessionState::Idle) {
            SessionState::Receiving { request, .. } => {
                request
                    .reject()
                    .await
                    .map_err(|e| WormholeError::TransferFailed(e.to_string()))?;
                Ok(())
            }
            _ => Err(WormholeError::NoActiveSession.into()),
        }
    }

    /// Cancel any active operation
    #[napi]
    pub fn cancel(&self) {
        // For now, just reset state
        // TODO: Implement proper cancellation with oneshot channel
        let state = self.state.clone();
        tokio::spawn(async move {
            let mut s = state.lock().await;
            *s = SessionState::Idle;
        });
    }
}

impl Default for WormholeClient {
    fn default() -> Self {
        Self::new()
    }
}
