# Repository & Linux AppImage Guidelines

## AppImage Wayland EGL Display Initialization (`EGL_BAD_PARAMETER`)
When bundling Tauri applications as AppImages for Linux on Wayland, an `EGL_BAD_PARAMETER` display hang can occur because the AppImage's bundled `libwayland-client.so` gets loaded ahead of the host compositor's library.

### Fixed Pattern:
- **DMABUF (`WEBKIT_DISABLE_DMABUF_RENDERER=1`)**: Resolves blank/white webview window rendering issues on WebKitGTK/Linux.
- **Wayland Self-Reexec (`appimage_wayland_preload_fix`)**: Resolves `EGL_BAD_PARAMETER` crashes by finding the host system's 64-bit `libwayland-client.so.0` (`/usr/lib64/`, `/usr/lib/x86_64-linux-gnu/`, `/usr/lib/`) and re-executing the binary with `LD_PRELOAD` set when running inside an AppImage (`APPIMAGE` env set) on a Wayland session (`WAYLAND_DISPLAY` env set).
