//! Native Magic Wormhole bindings for Wormhole Desktop
//!
//! This module provides napi-rs bindings to magic-wormhole-rs,
//! replacing the Docker-based CLI approach.

mod error;
mod types;
mod wormhole;

use napi_derive::napi;

// Re-export types for JavaScript
pub use types::{ProgressEvent, ReceiveOffer};
pub use wormhole::WormholeClient;

/// Hello world test function to verify napi-rs setup
#[napi]
pub fn hello() -> String {
    "Hello from wormhole-native!".to_string()
}

/// Add two numbers - basic async test
#[napi]
pub async fn add(a: u32, b: u32) -> u32 {
    a + b
}

/// Get version string
#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
