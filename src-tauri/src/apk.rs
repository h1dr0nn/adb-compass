// APK Module - APK file handling and installation
// Manages APK validation and installation process

use serde::Serialize;
use std::path::Path;

/// Information about an APK file
#[derive(Debug, Clone, serde::Serialize)]
pub struct ApkInfo {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub valid: bool,
    pub last_modified: Option<u128>,
    pub package_id: Option<String>,
    pub version_name: Option<String>,
}

/// Read `android:versionName`. Plain APKs read the binary manifest (literal or
/// resource reference resolved via resources.arsc); split bundles (xapk/apks/
/// apkm) read the bundle's manifest.json or fall back to the nested base APK.
fn extract_version_name(apk_path: &str) -> Option<String> {
    if is_bundle_path(apk_path) {
        return extract_bundle_version(apk_path);
    }

    let file = std::fs::File::open(apk_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;

    let raw = {
        let mut mf = archive.by_name("AndroidManifest.xml").ok()?;
        let mut b = Vec::new();
        std::io::Read::read_to_end(&mut mf, &mut b).ok()?;
        b
    };
    let doc = axmldecoder::parse(&raw).ok()?;
    let root = match doc.get_root() {
        Some(axmldecoder::Node::Element(e)) => e,
        _ => return None,
    };
    if root.get_tag() != "manifest" {
        return None;
    }
    let attrs = root.get_attributes();
    let v = attrs
        .get("android:versionName")
        .or_else(|| attrs.get("versionName"))?;

    if !v.contains("Reference") {
        return Some(v.clone());
    }

    // Resource reference: resolve the id to its string value via resources.arsc.
    let id: u32 = v.rsplit('/').next()?.trim().parse().ok()?;
    let arsc = {
        let mut f = archive.by_name("resources.arsc").ok()?;
        let mut b = Vec::new();
        std::io::Read::read_to_end(&mut f, &mut b).ok()?;
        b
    };
    resolve_resource_files(&arsc, id)?
        .into_iter()
        .map(|(_, s)| s)
        .find(|s| !s.is_empty())
}

/// versionName of a split bundle. Prefer the nested base APK's real
/// `android:versionName` (the true marketing version); fall back to the
/// bundle manifest.json only if that fails — note APKPure often sets
/// manifest.json `version_name` to the numeric version code (e.g. "17").
fn extract_bundle_version(bundle_path: &str) -> Option<String> {
    let file = std::fs::File::open(bundle_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;

    // 1) Base APK's real manifest version.
    let mut apks: Vec<(usize, String, u64)> = Vec::new();
    for i in 0..archive.len() {
        let (name, size) = match archive.by_index(i) {
            Ok(f) => (f.name().to_string(), f.size()),
            Err(_) => continue,
        };
        let lower = name.to_lowercase();
        if lower.ends_with(".apk") {
            let base = lower.rsplit('/').next().unwrap_or(&lower).to_string();
            apks.push((i, base, size));
        }
    }
    apks.sort_by(|a, b| {
        a.1.starts_with("config")
            .cmp(&b.1.starts_with("config"))
            .then(b.2.cmp(&a.2))
    });

    if let Some((base_idx, base_name, _)) = apks.first().cloned() {
        let tmp = std::env::temp_dir().join(format!(
            "adbcompass_ver_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        if std::fs::create_dir_all(&tmp).is_ok() {
            let out = tmp.join(&base_name);
            {
                if let Ok(mut entry) = archive.by_index(base_idx) {
                    if let Ok(mut f) = std::fs::File::create(&out) {
                        let _ = std::io::copy(&mut entry, &mut f);
                    }
                }
            }
            let v = extract_version_name(&out.to_string_lossy());
            let _ = std::fs::remove_dir_all(&tmp);
            if let Some(ver) = v {
                return Some(ver);
            }
        }
    }

    // 2) Fallback: bundle manifest.json.
    if let Ok(mut mj) = archive.by_name("manifest.json") {
        let mut s = String::new();
        if std::io::Read::read_to_string(&mut mj, &mut s).is_ok() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                if let Some(ver) = v
                    .get("version_name")
                    .or_else(|| v.get("versionName"))
                    .and_then(|x| x.as_str())
                {
                    if !ver.is_empty() {
                        return Some(ver.to_string());
                    }
                }
            }
        }
    }

    None
}

fn extract_package_id(apk_path: &str) -> Option<String> {
    let file = std::fs::File::open(apk_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;
    let mut manifest_file = archive.by_name("AndroidManifest.xml").ok()?;
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut manifest_file, &mut bytes).ok()?;

    let doc = axmldecoder::parse(&bytes).ok()?;
    if let Some(axmldecoder::Node::Element(ref root)) = doc.get_root() {
        if root.get_tag() == "manifest" {
            if let Some(package) = root.get_attributes().get("package") {
                return Some(package.to_string());
            }
        }
    }
    None
}

/// Density qualifier rank (higher = sharper) parsed from a resource path.
fn density_score(path: &str) -> i32 {
    if path.contains("xxxhdpi") {
        6
    } else if path.contains("xxhdpi") {
        5
    } else if path.contains("xhdpi") {
        4
    } else if path.contains("hdpi") {
        3
    } else if path.contains("mdpi") {
        2
    } else if path.contains("ldpi") {
        1
    } else {
        0
    }
}

/// Best-effort launcher icon of an installable file as a data URL. Routes split
/// bundles (xapk/apks/apkm) through a dedicated path, since their icon lives at
/// the bundle root or inside the nested base APK rather than under `res/`.
pub fn extract_apk_icon(apk_path: &str) -> Option<String> {
    if is_bundle_path(apk_path) {
        return extract_bundle_icon(apk_path);
    }
    extract_raster_icon(apk_path)
}

/// Pull a launcher icon out of a split bundle. APKPure XAPKs ship a root
/// `icon.png`; otherwise we extract the base APK and scan it for `ic_launcher`.
fn extract_bundle_icon(bundle_path: &str) -> Option<String> {
    use base64::Engine;

    let file = std::fs::File::open(bundle_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;

    let mut root_icon: Option<(usize, &'static str)> = None;
    let mut apks: Vec<(usize, String, u64)> = Vec::new();
    for i in 0..archive.len() {
        let (name, size) = match archive.by_index(i) {
            Ok(f) => (f.name().to_string(), f.size()),
            Err(_) => continue,
        };
        let lower = name.to_lowercase();
        let base = lower.rsplit('/').next().unwrap_or(&lower);
        if !lower.contains('/') && (base == "icon.png" || base == "icon.webp") {
            if root_icon.is_none() {
                let mime = if base.ends_with(".png") {
                    "image/png"
                } else {
                    "image/webp"
                };
                root_icon = Some((i, mime));
            }
        } else if lower.ends_with(".apk") {
            apks.push((i, base.to_string(), size));
        }
    }

    // Prefer the bundle's own root icon.
    if let Some((idx, mime)) = root_icon {
        let mut entry = archive.by_index(idx).ok()?;
        let mut bytes = Vec::new();
        if std::io::Read::read_to_end(&mut entry, &mut bytes).is_ok() && !bytes.is_empty() {
            return Some(format!(
                "data:{};base64,{}",
                mime,
                base64::engine::general_purpose::STANDARD.encode(&bytes)
            ));
        }
    }

    // Otherwise extract the base APK (non-config split, largest) and scan it.
    apks.sort_by(|a, b| {
        let a_config = a.1.starts_with("config");
        let b_config = b.1.starts_with("config");
        a_config.cmp(&b_config).then(b.2.cmp(&a.2))
    });
    let (base_idx, base_name, _) = apks.first()?.clone();

    let tmp = std::env::temp_dir().join(format!(
        "adbcompass_icon_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    std::fs::create_dir_all(&tmp).ok()?;
    let out = tmp.join(&base_name);
    {
        let mut entry = archive.by_index(base_idx).ok()?;
        if let Ok(mut f) = std::fs::File::create(&out) {
            let _ = std::io::copy(&mut entry, &mut f);
        }
    }
    let result = extract_raster_icon(&out.to_string_lossy());
    let _ = std::fs::remove_dir_all(&tmp);
    result
}

/// Resolve a plain APK's launcher icon. Order of attempts: (1) resolve the
/// manifest icon reference through resources.arsc (accurate even when resource
/// files are obfuscated/renamed by R8), (2) a conventional `ic_launcher` name
/// scan, (3) a shape/size heuristic as a last resort.
fn extract_raster_icon(apk_path: &str) -> Option<String> {
    let file = std::fs::File::open(apk_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;

    if let Some(url) = extract_icon_via_arsc(&mut archive) {
        return Some(url);
    }
    if let Some(url) = scan_named_launcher(&mut archive) {
        return Some(url);
    }
    scan_square_icon(&mut archive)
}

/// Read a zip entry by name and wrap its bytes as a data URL.
fn entry_to_data_url(
    archive: &mut zip::ZipArchive<std::fs::File>,
    path: &str,
    mime: &str,
) -> Option<String> {
    use base64::Engine;
    let mut entry = archive.by_name(path).ok()?;
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut entry, &mut bytes).ok()?;
    if bytes.is_empty() {
        return None;
    }
    Some(format!(
        "data:{};base64,{}",
        mime,
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    ))
}

/// Resolve the application icon via AndroidManifest + resources.arsc, picking
/// the highest-density raster the icon resource maps to.
fn extract_icon_via_arsc(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<String> {
    let icon_id = read_manifest_icon_id(archive)?;

    let arsc = {
        let mut f = archive.by_name("resources.arsc").ok()?;
        let mut b = Vec::new();
        std::io::Read::read_to_end(&mut f, &mut b).ok()?;
        b
    };

    let mut paths = resolve_resource_files(&arsc, icon_id)?;
    // Keep raster icons only (drop adaptive .xml); prefer the highest density.
    paths.retain(|(_, p)| {
        let l = p.to_lowercase();
        l.ends_with(".png") || l.ends_with(".webp")
    });
    paths.sort_by_key(|(d, _)| density_rank(*d));
    let (_, path) = paths.last()?.clone();
    let mime = if path.to_lowercase().ends_with(".png") {
        "image/png"
    } else {
        "image/webp"
    };
    entry_to_data_url(archive, &path, mime)
}

/// Rank an arsc config density (real densities beat default/anydpi/nodpi which
/// would point at a vector adaptive icon).
fn density_rank(d: u16) -> u32 {
    match d {
        0 | 0xFFFE | 0xFFFF => 1,
        v => v as u32,
    }
}

/// Parse the `application@icon` resource reference id from the binary manifest.
fn read_manifest_icon_id(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<u32> {
    let mut bytes = Vec::new();
    {
        let mut mf = archive.by_name("AndroidManifest.xml").ok()?;
        std::io::Read::read_to_end(&mut mf, &mut bytes).ok()?;
    }
    let doc = axmldecoder::parse(&bytes).ok()?;
    let root = match doc.get_root() {
        Some(axmldecoder::Node::Element(e)) => e,
        _ => return None,
    };
    for child in root.get_children() {
        if let axmldecoder::Node::Element(e) = child {
            if e.get_tag() == "application" {
                let attrs = e.get_attributes();
                let v = attrs.get("android:icon").or_else(|| attrs.get("icon"))?;
                // axmldecoder formats references as "...Reference/<id>".
                return v.rsplit('/').next()?.trim().parse::<u32>().ok();
            }
        }
    }
    None
}

// ---------- minimal resources.arsc reader (resource id -> file paths) ----------

fn arsc_u16(d: &[u8], o: usize) -> Option<u16> {
    d.get(o..o + 2).map(|b| u16::from_le_bytes([b[0], b[1]]))
}
fn arsc_u32(d: &[u8], o: usize) -> Option<u32> {
    d.get(o..o + 4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// Resolve a resource id to its concrete string (file path) values across every
/// config in resources.arsc. Returns (density, path) pairs.
fn resolve_resource_files(arsc: &[u8], res_id: u32) -> Option<Vec<(u16, String)>> {
    if arsc_u16(arsc, 0)? != 0x0002 {
        return None;
    }
    let table_header = arsc_u16(arsc, 2)? as usize;
    let gpool_off = table_header;
    let global = arsc_parse_string_pool(arsc, gpool_off)?;
    let gpool_size = arsc_u32(arsc, gpool_off + 4)? as usize;

    let target_pkg = (res_id >> 24) & 0xff;
    let target_type = ((res_id >> 16) & 0xff) as u8;
    let target_entry = (res_id & 0xffff) as usize;

    let mut results: Vec<(u16, String)> = Vec::new();
    let mut off = gpool_off + gpool_size;
    while off + 8 <= arsc.len() {
        let ctype = arsc_u16(arsc, off)?;
        let csize = arsc_u32(arsc, off + 4)? as usize;
        if csize < 8 {
            break;
        }
        if ctype == 0x0200 && arsc_u32(arsc, off + 8)? == target_pkg {
            arsc_scan_package(arsc, off, csize, target_type, target_entry, &global, &mut results);
        }
        off += csize;
    }
    if results.is_empty() {
        None
    } else {
        Some(results)
    }
}

fn arsc_scan_package(
    d: &[u8],
    pkg_off: usize,
    pkg_size: usize,
    target_type: u8,
    target_entry: usize,
    global: &[String],
    results: &mut Vec<(u16, String)>,
) {
    let header = match arsc_u16(d, pkg_off + 2) {
        Some(h) => h as usize,
        None => return,
    };
    let end = (pkg_off + pkg_size).min(d.len());
    let mut off = pkg_off + header;
    while off + 8 <= end {
        let ctype = match arsc_u16(d, off) {
            Some(t) => t,
            None => break,
        };
        let csize = match arsc_u32(d, off + 4) {
            Some(s) => s as usize,
            None => break,
        };
        if csize < 8 {
            break;
        }
        if ctype == 0x0201 && d.get(off + 8) == Some(&target_type) {
            if let Some(found) = arsc_scan_type(d, off, target_entry, global) {
                results.push(found);
            }
        }
        off += csize;
    }
}

fn arsc_scan_type(
    d: &[u8],
    off: usize,
    target_entry: usize,
    global: &[String],
) -> Option<(u16, String)> {
    let header = arsc_u16(d, off + 2)? as usize;
    let entry_count = arsc_u32(d, off + 12)? as usize;
    let entries_start = arsc_u32(d, off + 16)? as usize;
    let density = arsc_u16(d, off + 34)?; // ResTable_config.density
    if target_entry >= entry_count {
        return None;
    }
    let entry_off = arsc_u32(d, off + header + target_entry * 4)?;
    if entry_off == 0xFFFF_FFFF {
        return None; // entry absent in this config
    }
    let epos = off + entries_start + entry_off as usize;
    let esize = arsc_u16(d, epos)? as usize;
    let eflags = arsc_u16(d, epos + 2)?;
    if eflags & 0x0001 != 0 {
        return None; // complex map, not a direct file value
    }
    let vpos = epos + esize;
    let data_type = *d.get(vpos + 3)?;
    let data = arsc_u32(d, vpos + 4)?;
    if data_type == 0x03 {
        // TYPE_STRING -> index into the global string pool (a file path)
        return global.get(data as usize).map(|p| (density, p.clone()));
    }
    None
}

fn arsc_parse_string_pool(d: &[u8], off: usize) -> Option<Vec<String>> {
    let header = arsc_u16(d, off + 2)? as usize;
    let count = arsc_u32(d, off + 8)? as usize;
    let flags = arsc_u32(d, off + 16)?;
    let strings_start = arsc_u32(d, off + 20)? as usize;
    let utf8 = flags & 0x100 != 0;
    let offsets = off + header;
    let data_start = off + strings_start;
    let mut out = Vec::with_capacity(count.min(200_000));
    for i in 0..count {
        let so = arsc_u32(d, offsets + i * 4)? as usize;
        let p = data_start + so;
        let s = if utf8 { arsc_utf8(d, p) } else { arsc_utf16(d, p) }.unwrap_or_default();
        out.push(s);
    }
    Some(out)
}

fn arsc_len8(d: &[u8], o: usize) -> Option<(usize, usize)> {
    let b0 = *d.get(o)? as usize;
    if b0 & 0x80 != 0 {
        let b1 = *d.get(o + 1)? as usize;
        Some((((b0 & 0x7f) << 8) | b1, 2))
    } else {
        Some((b0, 1))
    }
}

fn arsc_utf8(d: &[u8], mut o: usize) -> Option<String> {
    let (_, n1) = arsc_len8(d, o)?; // char count (unused)
    o += n1;
    let (blen, n2) = arsc_len8(d, o)?; // byte count
    o += n2;
    let bytes = d.get(o..o + blen)?;
    Some(String::from_utf8_lossy(bytes).to_string())
}

fn arsc_utf16(d: &[u8], mut o: usize) -> Option<String> {
    let mut len = arsc_u16(d, o)? as usize;
    o += 2;
    if len & 0x8000 != 0 {
        let ext = arsc_u16(d, o)? as usize;
        o += 2;
        len = ((len & 0x7fff) << 16) | ext;
    }
    let mut u16s = Vec::with_capacity(len.min(200_000));
    for i in 0..len {
        u16s.push(arsc_u16(d, o + i * 2)?);
    }
    Some(String::from_utf16_lossy(&u16s))
}

/// Scan a plain APK for the highest-priority `ic_launcher` raster (png/webp).
fn scan_named_launcher(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<String> {
    use base64::Engine;

    let mut best: Option<(i32, usize, &'static str)> = None;
    for i in 0..archive.len() {
        let name = match archive.by_index(i) {
            Ok(f) => f.name().to_string(),
            Err(_) => continue,
        };
        let lower = name.to_lowercase();
        if !lower.starts_with("res/") {
            continue;
        }
        if !(lower.contains("mipmap") || lower.contains("drawable")) {
            continue;
        }
        let file_name = lower.rsplit('/').next().unwrap_or(&lower);
        let mime = if file_name.ends_with(".png") {
            "image/png"
        } else if file_name.ends_with(".webp") {
            "image/webp"
        } else {
            continue;
        };
        if file_name.contains("background") || file_name.contains("monochrome") {
            continue;
        }

        let is_launcher = file_name.starts_with("ic_launcher")
            || file_name.contains("launcher")
            || file_name.contains("ic_app")
            || file_name == "icon.png"
            || file_name == "icon.webp";

        let name_rank = if file_name.starts_with("ic_launcher")
            && !file_name.contains("foreground")
            && !file_name.contains("round")
        {
            5
        } else if file_name.contains("round") && file_name.contains("launcher") {
            4
        } else if file_name.contains("foreground") {
            3
        } else if is_launcher {
            2
        } else if lower.contains("mipmap") {
            1
        } else {
            continue;
        };

        let score = name_rank * 100 + density_score(&lower);
        if best.map(|(s, _, _)| score > s).unwrap_or(true) {
            best = Some((score, i, mime));
        }
    }

    let (_, idx, mime) = best?;
    let mut entry = archive.by_index(idx).ok()?;
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut entry, &mut bytes).ok()?;
    if bytes.is_empty() {
        return None;
    }
    Some(format!(
        "data:{};base64,{}",
        mime,
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    ))
}

/// Find a launcher icon by shape/size when names are obfuscated: the largest
/// square png/webp whose dimension is a standard launcher size. Densities up to
/// xxxhdpi (192) are preferred over store/web sizes (256-512).
fn scan_square_icon(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<String> {
    use base64::Engine;
    const SIZES: [u32; 8] = [48, 72, 96, 144, 192, 256, 432, 512];

    let mut best: Option<(i64, &'static str, Vec<u8>)> = None; // (rank, mime, bytes)
    for i in 0..archive.len() {
        let (name, size) = match archive.by_index(i) {
            Ok(f) => (f.name().to_string(), f.size()),
            Err(_) => continue,
        };
        let lower = name.to_lowercase();
        if !lower.starts_with("res/") {
            continue;
        }
        let mime = if lower.ends_with(".png") {
            "image/png"
        } else if lower.ends_with(".webp") {
            "image/webp"
        } else {
            continue;
        };
        // Launcher icons are small; skip big assets to keep this cheap.
        if size == 0 || size > 600_000 {
            continue;
        }

        let mut bytes = Vec::new();
        {
            let mut entry = match archive.by_index(i) {
                Ok(e) => e,
                Err(_) => continue,
            };
            if std::io::Read::read_to_end(&mut entry, &mut bytes).is_err() {
                continue;
            }
        }
        let dims = image::ImageReader::new(std::io::Cursor::new(&bytes))
            .with_guessed_format()
            .ok()
            .and_then(|r| r.into_dimensions().ok());
        let (w, h) = match dims {
            Some(d) => d,
            None => continue,
        };
        if w != h || !SIZES.contains(&w) {
            continue;
        }
        // Prefer real launcher densities (<=192) over web/store sizes.
        let rank = if w <= 192 { w as i64 + 1000 } else { w as i64 };
        if best.as_ref().map(|(r, _, _)| rank > *r).unwrap_or(true) {
            best = Some((rank, mime, bytes));
        }
    }

    let (_, mime, bytes) = best?;
    Some(format!(
        "data:{};base64,{}",
        mime,
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    ))
}

impl ApkInfo {
    pub fn from_path(path: &str) -> Option<Self> {
        let path_obj = Path::new(path);

        if !path_obj.exists() {
            return None;
        }

        let file_name = path_obj
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.apk")
            .to_string();

        let metadata = std::fs::metadata(path).ok()?;
        let size_bytes = metadata.len();

        let last_modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis());

        let valid = path_obj
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| {
                let e = e.to_lowercase();
                e == "apk" || BUNDLE_EXTS.contains(&e.as_str())
            })
            .unwrap_or(false);

        let (package_id, version_name) = if valid {
            (extract_package_id(path), extract_version_name(path))
        } else {
            (None, None)
        };

        Some(Self {
            path: path.to_string(),
            file_name,
            size_bytes,
            valid,
            last_modified,
            package_id,
            version_name,
        })
    }
}

/// Result of an APK installation
#[derive(Debug, Clone, Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub device_id: String,
    pub message: String,
    pub error_code: Option<String>,
}

impl InstallResult {
    pub fn success(device_id: &str, message: &str) -> Self {
        Self {
            success: true,
            device_id: device_id.to_string(),
            message: message.to_string(),
            error_code: None,
        }
    }

    pub fn failure(device_id: &str, message: &str, error_code: Option<&str>) -> Self {
        Self {
            success: false,
            device_id: device_id.to_string(),
            message: message.to_string(),
            error_code: error_code.map(|s| s.to_string()),
        }
    }
}

/// Map ADB install error codes to user-friendly messages
pub fn map_install_error(error_output: &str) -> (String, Option<String>) {
    let error_mappings = [
        (
            "INSTALL_FAILED_ALREADY_EXISTS",
            "App is already installed. Try uninstalling first.",
        ),
        (
            "INSTALL_FAILED_INSUFFICIENT_STORAGE",
            "Not enough storage space on device.",
        ),
        (
            "INSTALL_FAILED_INVALID_APK",
            "Invalid or corrupted APK file.",
        ),
        (
            "INSTALL_FAILED_VERSION_DOWNGRADE",
            "Cannot install older version over newer one.",
        ),
        (
            "INSTALL_FAILED_USER_RESTRICTED",
            "Installation blocked by device policy.",
        ),
        (
            "INSTALL_FAILED_UPDATE_INCOMPATIBLE",
            "Update incompatible with installed version.",
        ),
        (
            "INSTALL_PARSE_FAILED_NO_CERTIFICATES",
            "APK is not signed properly.",
        ),
        (
            "INSTALL_FAILED_OLDER_SDK",
            "App requires newer Android version.",
        ),
        (
            "INSTALL_FAILED_CONFLICTING_PROVIDER",
            "Conflicts with another installed app.",
        ),
        (
            "INSTALL_FAILED_NO_MATCHING_ABIS",
            "App not compatible with device architecture.",
        ),
    ];

    for (code, message) in error_mappings {
        if error_output.contains(code) {
            return (message.to_string(), Some(code.to_string()));
        }
    }

    // Default error message
    (
        "Installation failed. Check device connection and try again.".to_string(),
        None,
    )
}

/// Helper for APK installation
pub struct ApkInstaller<'a> {
    executor: &'a crate::adb::AdbExecutor,
}

impl<'a> ApkInstaller<'a> {
    pub fn new(executor: &'a crate::adb::AdbExecutor) -> Self {
        Self { executor }
    }

    /// Install an APK or a split-bundle (.xapk/.apks/.apkm) on a device.
    pub fn install(&self, device_id: &str, apk_path: &str) -> InstallResult {
        // Verify file exists
        if !std::path::Path::new(apk_path).exists() {
            return InstallResult::failure(device_id, "APK file not found", None);
        }

        // Split bundles need extraction + install-multiple (+ OBB push).
        if is_bundle_path(apk_path) {
            return self.install_bundle(device_id, apk_path);
        }

        let output = self.executor.run_with_retry(
            || {
                let mut cmd = crate::command_utils::hidden_command(self.executor.get_adb_path());
                cmd.args(["-s", device_id, "install", "-r", apk_path]);
                cmd
            },
            std::time::Duration::from_secs(120),
            0,
        );

        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let stderr = String::from_utf8_lossy(&result.stderr);
                let combined = format!("{}{}", stdout, stderr);

                if result.status.success() && combined.contains("Success") {
                    InstallResult::success(device_id, "APK installed successfully")
                } else {
                    let (message, error_code) = map_install_error(&combined);
                    InstallResult::failure(device_id, &message, error_code.as_deref())
                }
            }
            Err(e) => InstallResult::failure(device_id, &format!("Failed to run adb: {}", e), None),
        }
    }

    /// Install a split bundle: extract the zip, install all APKs atomically
    /// with `install-multiple`, then push any OBB expansion files.
    fn install_bundle(&self, device_id: &str, bundle_path: &str) -> InstallResult {
        let tmp = std::env::temp_dir().join(format!(
            "adbcompass_bundle_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        if std::fs::create_dir_all(&tmp).is_err() {
            return InstallResult::failure(device_id, "Failed to prepare bundle", None);
        }
        let result = self.install_bundle_inner(device_id, bundle_path, &tmp);
        let _ = std::fs::remove_dir_all(&tmp);
        result
    }

    fn install_bundle_inner(
        &self,
        device_id: &str,
        bundle_path: &str,
        tmp: &std::path::Path,
    ) -> InstallResult {
        let file = match std::fs::File::open(bundle_path) {
            Ok(f) => f,
            Err(e) => return InstallResult::failure(device_id, &format!("Open failed: {}", e), None),
        };
        let mut archive = match zip::ZipArchive::new(file) {
            Ok(a) => a,
            Err(_) => return InstallResult::failure(device_id, "Invalid bundle archive", None),
        };

        let mut apks: Vec<std::path::PathBuf> = Vec::new();
        let mut obbs: Vec<(String, std::path::PathBuf)> = Vec::new();
        let mut manifest_json: Option<String> = None;

        for i in 0..archive.len() {
            let mut entry = match archive.by_index(i) {
                Ok(e) => e,
                Err(_) => continue,
            };
            if entry.is_dir() {
                continue;
            }
            let name = entry.name().to_string();
            let lower = name.to_lowercase();
            let base = name.rsplit('/').next().unwrap_or(&name).to_string();

            if lower.ends_with(".apk") {
                let out = tmp.join(&base);
                if let Ok(mut f) = std::fs::File::create(&out) {
                    if std::io::copy(&mut entry, &mut f).is_ok() {
                        apks.push(out);
                    }
                }
            } else if lower.ends_with(".obb") {
                let out = tmp.join(&base);
                if let Ok(mut f) = std::fs::File::create(&out) {
                    if std::io::copy(&mut entry, &mut f).is_ok() {
                        obbs.push((base, out));
                    }
                }
            } else if base == "manifest.json" {
                let mut s = String::new();
                if std::io::Read::read_to_string(&mut entry, &mut s).is_ok() {
                    manifest_json = Some(s);
                }
            }
        }

        if apks.is_empty() {
            return InstallResult::failure(device_id, "No APK found inside bundle", None);
        }

        // Install all splits atomically.
        let apk_args: Vec<String> = apks
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        let output = self.executor.run_with_retry(
            || {
                let mut cmd = crate::command_utils::hidden_command(self.executor.get_adb_path());
                cmd.arg("-s").arg(device_id).arg("install-multiple").arg("-r");
                for a in &apk_args {
                    cmd.arg(a);
                }
                cmd
            },
            std::time::Duration::from_secs(300),
            0,
        );

        let combined = match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout).to_string();
                let stderr = String::from_utf8_lossy(&result.stderr).to_string();
                let combined = format!("{}{}", stdout, stderr);
                if !(result.status.success() && combined.contains("Success")) {
                    let (message, error_code) = map_install_error(&combined);
                    return InstallResult::failure(device_id, &message, error_code.as_deref());
                }
                combined
            }
            Err(e) => {
                return InstallResult::failure(device_id, &format!("Failed to run adb: {}", e), None)
            }
        };
        let _ = combined;

        // Best-effort OBB push (large-game expansion files).
        if !obbs.is_empty() {
            if let Some(pkg) = bundle_package(manifest_json.as_deref(), &apks) {
                let obb_dir = format!("/sdcard/Android/obb/{}", pkg);
                let _ = self
                    .executor
                    .run_with_retry(
                        || {
                            let mut cmd = crate::command_utils::hidden_command(
                                self.executor.get_adb_path(),
                            );
                            cmd.args(["-s", device_id, "shell", "mkdir", "-p", &obb_dir]);
                            cmd
                        },
                        std::time::Duration::from_secs(30),
                        0,
                    );
                for (obb_name, obb_path) in &obbs {
                    let remote = format!("{}/{}", obb_dir, obb_name);
                    let local = obb_path.to_string_lossy().to_string();
                    let _ = self.executor.run_with_retry(
                        || {
                            let mut cmd = crate::command_utils::hidden_command(
                                self.executor.get_adb_path(),
                            );
                            cmd.args(["-s", device_id, "push", &local, &remote]);
                            cmd
                        },
                        std::time::Duration::from_secs(300),
                        0,
                    );
                }
            }
        }

        InstallResult::success(device_id, "Bundle installed successfully")
    }
}

/// Bundle file extensions that hold multiple split APKs.
const BUNDLE_EXTS: [&str; 3] = ["xapk", "apks", "apkm"];

/// Whether a path is a split-bundle (xapk/apks/apkm) rather than a plain apk.
pub fn is_bundle_path(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| BUNDLE_EXTS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Resolve the package name for OBB placement, from the XAPK manifest.json if
/// present, otherwise by reading the package id out of one of the split APKs.
fn bundle_package(manifest_json: Option<&str>, apks: &[std::path::PathBuf]) -> Option<String> {
    if let Some(json) = manifest_json {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(json) {
            if let Some(pkg) = value.get("package_name").and_then(|v| v.as_str()) {
                return Some(pkg.to_string());
            }
        }
    }
    for apk in apks {
        if let Some(pkg) = extract_package_id(&apk.to_string_lossy()) {
            return Some(pkg);
        }
    }
    None
}
