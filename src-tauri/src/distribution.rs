/**
 * distribution.rs
 *
 * Summary: Detects application distribution channel (Microsoft Store MSIX package identity vs. standalone installer).
 * On Windows, queries GetCurrentPackageFullName from kernel32.dll.
 * On Unix (Linux/macOS), defaults to standalone.
 * Supports STRATA_FORCE_MSIX=1 environment variable for testing/development.
 */

#[cfg(target_os = "windows")]
extern "system" {
    fn GetCurrentPackageFullName(
        package_full_name_length: *mut u32,
        package_full_name: *mut u16,
    ) -> i32;
}

#[cfg(target_os = "windows")]
pub fn is_store_package() -> bool {
    if let Ok(val) = std::env::var("STRATA_FORCE_MSIX") {
        if val == "1" || val.eq_ignore_ascii_case("true") {
            return true;
        }
    }

    let mut length: u32 = 0;
    let res = unsafe { GetCurrentPackageFullName(&mut length, std::ptr::null_mut()) };
    // 0 = ERROR_SUCCESS, 122 = ERROR_INSUFFICIENT_BUFFER (means package identity exists)
    // 15700 = APPMODEL_ERROR_NO_PACKAGE (unpackaged Win32/MSI)
    res == 0 || res == 122
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

    #[test]
    fn test_distribution_channel_default() {
        std::env::remove_var("STRATA_FORCE_MSIX");
        #[cfg(not(target_os = "windows"))]
        {
            assert!(!is_store_package());
            assert!(is_standalone());
            assert_eq!(get_distribution_channel(), "standalone");
        }
    }

    #[test]
    fn test_distribution_channel_force_override() {
        std::env::set_var("STRATA_FORCE_MSIX", "1");
        assert!(is_store_package());
        assert!(!is_standalone());
        assert_eq!(get_distribution_channel(), "store");
        std::env::remove_var("STRATA_FORCE_MSIX");
    }
}
