/**
 * distribution.rs
 *
 * Summary: Detects application distribution channel (Microsoft Store managed on Windows vs. standalone installer on Linux).
 * On Windows, Strata is distributed as a Store-managed package (MSI -> MSIX) with auto-updates disabled in favor of Microsoft Store updates.
 * On Unix (Linux), defaults to standalone with CrabNebula auto-updates enabled.
 * Supports STRATA_FORCE_MSIX=1 / STRATA_FORCE_STANDALONE=1 environment variables for testing/development.
 */

#[cfg(target_os = "windows")]
pub fn is_store_package() -> bool {
    if let Ok(val) = std::env::var("STRATA_FORCE_STANDALONE") {
        if val == "1" || val.eq_ignore_ascii_case("true") {
            return false;
        }
    }
    true
}

#[cfg(not(target_os = "windows"))]
pub fn is_store_package() -> bool {
    if let Ok(val) = std::env::var("STRATA_FORCE_MSIX") {
        if val == "1" || val.eq_ignore_ascii_case("true") {
            return true;
        }
    }
    false
}

pub fn is_standalone() -> bool {
    !is_store_package()
}

#[tauri::command]
pub fn get_distribution_channel() -> &'static str {
    if is_store_package() {
        "store"
    } else {
        "standalone"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_distribution_channel_sequential() {
        let _guard = ENV_MUTEX.lock().unwrap();

        // 1. Test default standalone mode
        std::env::remove_var("STRATA_FORCE_MSIX");
        #[cfg(not(target_os = "windows"))]
        {
            assert!(!is_store_package());
            assert!(is_standalone());
            assert_eq!(get_distribution_channel(), "standalone");
        }

        // 2. Test forced override mode
        std::env::set_var("STRATA_FORCE_MSIX", "1");
        assert!(is_store_package());
        assert!(!is_standalone());
        assert_eq!(get_distribution_channel(), "store");

        // Clean up environment variable
        std::env::remove_var("STRATA_FORCE_MSIX");
    }
}
