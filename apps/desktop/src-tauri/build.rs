// Bake the absolute path of the workspace root into the binary so the
// runtime can locate the Node sidecar without having to guess. In dev mode,
// the sidecar lives at `<workspace_root>/packages/cli/dist/sidecar.cjs`.

fn main() {
    let manifest_dir = std::path::PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set"),
    );
    // src-tauri (manifest_dir) → desktop → apps → workspace_root
    let workspace_root = manifest_dir
        .ancestors()
        .nth(3)
        .expect("could not resolve workspace root from CARGO_MANIFEST_DIR");
    println!(
        "cargo:rustc-env=ANTIGRAM_WORKSPACE_ROOT={}",
        workspace_root.display()
    );
    println!("cargo:rerun-if-changed=build.rs");
    tauri_build::build()
}
