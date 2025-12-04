//! Error types for the native wormhole bindings

use std::fmt;

/// Errors that can occur during wormhole operations
#[derive(Debug)]
pub enum WormholeError {
    /// Connection to relay server failed
    ConnectionFailed(String),
    /// Invalid wormhole code format
    InvalidCode(String),
    /// File transfer failed
    TransferFailed(String),
    /// Operation was cancelled
    Cancelled,
    /// File not found
    FileNotFound(String),
    /// IO error
    IoError(String),
    /// Wormhole protocol error
    ProtocolError(String),
    /// No active session
    NoActiveSession,
}

impl fmt::Display for WormholeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WormholeError::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            WormholeError::InvalidCode(msg) => write!(f, "Invalid code: {}", msg),
            WormholeError::TransferFailed(msg) => write!(f, "Transfer failed: {}", msg),
            WormholeError::Cancelled => write!(f, "Operation cancelled"),
            WormholeError::FileNotFound(path) => write!(f, "File not found: {}", path),
            WormholeError::IoError(msg) => write!(f, "IO error: {}", msg),
            WormholeError::ProtocolError(msg) => write!(f, "Protocol error: {}", msg),
            WormholeError::NoActiveSession => write!(f, "No active wormhole session"),
        }
    }
}

impl std::error::Error for WormholeError {}

impl From<WormholeError> for napi::Error {
    fn from(err: WormholeError) -> Self {
        napi::Error::from_reason(err.to_string())
    }
}

impl From<std::io::Error> for WormholeError {
    fn from(err: std::io::Error) -> Self {
        WormholeError::IoError(err.to_string())
    }
}
