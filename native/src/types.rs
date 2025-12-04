//! Type definitions for the native wormhole bindings

use napi_derive::napi;

/// Progress information for file transfers
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ProgressEvent {
    /// Bytes transferred so far
    pub transferred: i64,
    /// Total bytes to transfer
    pub total: i64,
    /// Percentage complete (0-100)
    pub percent: u32,
}

impl ProgressEvent {
    pub fn new(transferred: u64, total: u64) -> Self {
        let percent = if total > 0 {
            ((transferred as f64 / total as f64) * 100.0) as u32
        } else {
            0
        };
        Self {
            transferred: transferred as i64,
            total: total as i64,
            percent,
        }
    }
}

/// Information about an incoming file transfer offer
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ReceiveOffer {
    /// Name of the file being sent
    pub filename: String,
    /// Size of the file in bytes
    pub filesize: i64,
}

impl ReceiveOffer {
    pub fn new(filename: String, filesize: u64) -> Self {
        Self {
            filename,
            filesize: filesize as i64,
        }
    }
}
