"""
File: scripts/scan-secrets.py
Làm gì: Công cụ quét bí mật và cấu hình viết cứng cho toàn bộ dự án Trợ lý nấu ăn (T-INFRA, T23.1).
        Gồm 2 pha: (1) Quét toàn bộ lịch sử Git & file được theo dõi; (2) Kiểm toán thư mục làm việc
        bao phủ mọi application*.yml, docker-compose*.yml, *.env.example, mã backend src/main và mã app mobile.
Nhận vào: Tham số CLI tùy chọn: --audit-dir <đường_dẫn>, --skip-git.
Trả ra: Báo cáo chi tiết trên STDOUT và mã thoát 0 (CLEAN) hoặc 1 (PHÁT HIỆN VI PHẠM).
Ai gọi: pnpm verify (Bước 6), kiểm thử t23-audit.test.ts và developer chạy thủ công.
Bám theo: docs/tasks.md mục T23.1, AGENTS.md, docs/coding-rules.md.
"""

import argparse
import os
import re
import subprocess
import sys

# Bảo đảm xuất UTF-8 trên terminal Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ==============================================================================
# HẰNG SỐ MẪU NHẬN DIỆN BÍ MẬT, TỆP NHẠY CẢM VÀ ĐỊA CHỈ VIẾT CỨNG
# ==============================================================================
PRUNE_DIRS = frozenset({
    "node_modules",
    ".git",
    "target",
    "dist",
    ".expo",
    ".gradle",
    "build",
    ".pnpm-store",
    "coverage",
})

# Các mẫu khóa, token và bí mật phổ biến (quét cả lịch sử Git lẫn tệp hiện tại)
PATTERNS = {
    "Private Key Block": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----", re.I),
    "GitHub Token": re.compile(r"(?:ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{20,}", re.I),
    "AWS Access Key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "Google API Key": re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b"),
    "OpenAI / Anthropic Secret Key": re.compile(r"\bsk-[a-zA-Z0-9_-]{20,}\b"),
    "Slack Token": re.compile(r"\bxox[baprs]-[0-9a-zA-Z]{10,}\b"),
    "Stripe Secret Key": re.compile(r"\b[sr]k_live_[0-9a-zA-Z]{24,}\b"),
    "Hardcoded Password/Secret": re.compile(
        r"""(?:password|secret_key|api_key|token)\s*[:=]\s*["'][a-zA-Z0-9@#$%^&*!_-]{8,}["']""",
        re.I,
    ),
    "JWT Bearer Token": re.compile(r"\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b"),
}

# Các mẫu tên tệp nhạy cảm không bao giờ được phép theo dõi trong Git / repo
SENSITIVE_FILENAME_PATTERNS = [
    re.compile(r"^\.env(?!\.example$).*", re.I),
    re.compile(r".*\.pem$", re.I),
    re.compile(r".*\.key$", re.I),
    re.compile(r".*\.keystore$", re.I),
    re.compile(r".*\.jks$", re.I),
    re.compile(r".*\.p12$", re.I),
    re.compile(r".*\.pfx$", re.I),
    re.compile(r".*\.pkcs12$", re.I),
    re.compile(r"^id_rsa.*", re.I),
    re.compile(r"^id_ed25519.*", re.I),
    re.compile(r".*credentials\.json$", re.I),
    re.compile(r".*play-key.*\.json$", re.I),
    re.compile(r".*service-account.*\.json$", re.I),
]

# Địa chỉ URL có hostname (domain thật, localhost hoặc IPv4) hoặc địa chỉ IPv4 kèm cổng (chống viết cứng địa chỉ máy chủ)
HARDCODED_URL_REGEX = re.compile(
    r"https?://(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9-]+\.[A-Za-z0-9.-]+)(?::\d+)?(?:/[^\s\"'`<>\\)]*)?",
    re.I,
)
HARDCODED_IPV4_PORT_REGEX = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?):\d{1,5}\b"
)

# Các khóa YAML / thuộc tính mang tính bí mật hoặc URL máy chủ trong application*.yml & docker-compose*.yml
SENSITIVE_YAML_KEY_REGEX = re.compile(
    r"^\s*-?\s*(?:[A-Za-z0-9_.-]*(?:password|secret|api[-_]?key|token|device[-_]?salt|endpoint[-_]?url))\s*:\s*(.*)$",
    re.I,
)
SPRING_PLACEHOLDER_DEFAULT_REGEX = re.compile(
    r"\$\{([A-Za-z0-9_.-]+)(?::-?([^}]*))?\}"
)
JAVA_VALUE_DEFAULT_REGEX = re.compile(
    r'@Value\s*\(\s*"\$\{([A-Za-z0-9_.-]+):([^}]*)\}"\s*\)',
    re.I,
)
SENSITIVE_PROP_KEYS = (
    "password",
    "secret",
    "api-key",
    "api_key",
    "token",
    "device-salt",
    "device_salt",
    "endpoint-url",
    "endpoint_url",
)

# Ngoại lệ kỹ thuật cố định đã kiểm chứng không phải bí mật hoặc địa chỉ máy chủ thật
ALLOWED_TEST_SALT_PLACEHOLDER = "unit-test-h2-ephemeral"
COMPOSE_INTERNAL_POSTGRES_PREFIX = "jdbc:postgresql://postgres:5432/"
COMPOSE_HEALTHCHECK_LOOPBACK_REGEX = re.compile(
    r"curl\s+-fsS\s+http://127\.0\.0\.1:\$\$\{PORT:-\d+\}/health"
)
ENV_ASSIGNMENT_REGEX = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


def is_comment_line(stripped_line: str, extension: str) -> bool:
    """
    Làm gì: Kiểm tra một dòng mã hoặc cấu hình đã bỏ khoảng trắng đầu dòng có phải chú thích hay không.
    Vào: stripped_line (chuỗi đã strip()), extension (phần mở rộng tệp như '.java', '.yml', '.ts').
    Ra: True nếu dòng là chú thích thuần túy; False nếu là mã hoặc cấu hình thực thi.
    Gọi bởi: audit_file_for_t23().
    """
    if not stripped_line:
        return True
    if extension in (".yml", ".yaml", ".properties", ".example", ".sh"):
        return stripped_line.startswith("#")
    if stripped_line.startswith(("//", "/*", "*", "*/")):
        return True
    return False


def is_placeholder_expr_only(raw_value: str) -> bool:
    """
    Làm gì: Xác định giá trị YAML/Properties có hoàn toàn là biểu thức biến môi trường ${VAR} hay không.
    Vào: raw_value (giá trị sau dấu hai chấm trong YAML).
    Ra: True nếu là placeholder ${...} và mọi phần mặc định (nếu có) đều an toàn/rỗng.
    Ví dụ: '${COOK_AI_API_KEY:-}' -> True; 'my-secret' -> False; '${PASSWORD:abc}' -> False.
    Gọi bởi: audit_yaml_config_line().
    """
    val = raw_value.strip().strip('"').strip("'").strip()
    if not val or val in ('""', "''"):
        return True
    if not (val.startswith("${") and val.endswith("}")):
        return False

    # Kiểm tra từng placeholder phẳng không chứa giá trị mặc định viết cứng
    # Cho phép dạng lồng nhau rỗng như ${SPRING_DATASOURCE_PASSWORD:-${POSTGRES_PASSWORD:-}}
    inner = val[2:-1]
    if ":-" in inner:
        default_part = inner.split(":-", 1)[1]
    elif ":" in inner:
        default_part = inner.split(":", 1)[1]
    else:
        return True

    default_clean = default_part.strip()
    if default_clean == "" or default_clean == "${POSTGRES_PASSWORD:-}":
        return True
    return False


def normalize_rel_path(full_path: str, root_dir: str) -> str:
    """
    Làm gì: Chuẩn hóa đường dẫn tương đối bằng dấu gạch chéo '/' để đối chiếu đồng nhất giữa Windows và Linux.
    Vào: full_path (đường dẫn đầy đủ), root_dir (thư mục gốc cần kiểm toán).
    Ra: Chuỗi đường dẫn tương đối dạng POSIX (ví dụ 'apps/backend/src/main/resources/application.yml').
    Gọi bởi: audit_workspace_configs_and_code().
    """
    return os.path.relpath(full_path, root_dir).replace("\\", "/")


def check_classic_secret_patterns(rel_path: str, line_no: int, raw_line: str, findings: list) -> None:
    """
    Làm gì: Quét một dòng văn bản bằng toàn bộ mẫu khóa bí mật và token phổ biến.
    Vào: rel_path (đường dẫn tệp), line_no (số dòng), raw_line (nội dung dòng), findings (danh sách lỗi tích lũy).
    Ra: Bổ sung phần tử vào findings nếu phát hiện khớp mẫu bí mật.
    Gọi bởi: audit_file_for_t23().
    """
    for pat_name, pattern in PATTERNS.items():
        match = pattern.search(raw_line)
        if match:
            matched_preview = match.group(0)[:40] + ("..." if len(match.group(0)) > 40 else "")
            findings.append(f"{rel_path}:{line_no} [{pat_name}] Giá trị khớp: {matched_preview}")


def audit_yaml_config_line(
    rel_path: str,
    line_no: int,
    raw_line: str,
    is_compose: bool,
    is_test_resource: bool,
    findings: list,
) -> None:
    """
    Làm gì: Kiểm tra từng dòng cấu hình trong application*.yml hoặc docker-compose*.yml theo T23.1.
    Vào: rel_path, line_no, raw_line, is_compose, is_test_resource, findings.
    Ra: Ghi nhận vi phạm nếu phát hiện mật khẩu/khóa viết cứng hoặc URL CSDL/API bên ngoài viết cứng.
    Gọi bởi: audit_file_for_t23().
    """
    stripped = raw_line.strip()
    # Bỏ qua dòng chú thích YAML
    if not stripped or stripped.startswith("#"):
        return

    # Kiểm tra dòng khai báo thuộc tính nhạy cảm (password, secret, api-key, token, device-salt, endpoint-url)
    key_match = SENSITIVE_YAML_KEY_REGEX.match(raw_line)
    if key_match:
        value_part = key_match.group(1).strip()
        # Cho phép chuỗi rỗng ở password H2 trong test hoặc placeholder test salt Ephemeral duy nhất
        is_allowed_test_h2_empty = is_test_resource and value_part in ('""', "''", "")
        is_allowed_test_salt = (
            is_test_resource
            and ALLOWED_TEST_SALT_PLACEHOLDER in value_part
            and value_part == f"${{DEVICE_SALT:{ALLOWED_TEST_SALT_PLACEHOLDER}}}"
        )
        # Nếu không thuộc diện biến môi trường thuần túy hay ngoại lệ test hợp lệ -> báo lỗi viết cứng bí mật
        if not is_placeholder_expr_only(value_part) and not is_allowed_test_h2_empty and not is_allowed_test_salt:
            findings.append(f"{rel_path}:{line_no} [Hardcoded YAML Secret] {stripped[:100]}")

    # Kiểm tra URL JDBC / kết nối máy chủ trong application*.yml và docker-compose*.yml
    url_key_match = re.match(r"^\s*-?\s*(?:url|endpoint[-_]?url|SPRING_DATASOURCE_URL)\s*:\s*(.*)$", raw_line, re.I)
    if "jdbc:" in raw_line or url_key_match:
        is_allowed_h2_test = is_test_resource and "jdbc:h2:mem:" in raw_line
        is_allowed_compose_internal = (
            is_compose
            and "${SPRING_DATASOURCE_URL:-" in raw_line
            and COMPOSE_INTERNAL_POSTGRES_PREFIX in raw_line
        )
        is_pure_env_url = bool(url_key_match and is_placeholder_expr_only(url_key_match.group(1)))
        # Nếu URL kết nối dữ liệu chứa địa chỉ máy chủ thật thay vì biến môi trường hoặc DB bộ nhớ H2 -> báo lỗi
        if not (is_allowed_h2_test or is_allowed_compose_internal or is_pure_env_url):
            findings.append(f"{rel_path}:{line_no} [Hardcoded Datasource/Server URL] {stripped[:100]}")

    # Kiểm tra URL HTTP/HTTPS hoặc IP:Port viết cứng (ngoại trừ self-healthcheck nội bộ container Compose)
    is_compose_loopback_hc = is_compose and bool(COMPOSE_HEALTHCHECK_LOOPBACK_REGEX.search(raw_line))
    if not is_compose_loopback_hc:
        url_match = HARDCODED_URL_REGEX.search(raw_line)
        ip_match = HARDCODED_IPV4_PORT_REGEX.search(raw_line)
        if url_match or ip_match:
            hit = (url_match.group(0) if url_match else ip_match.group(0))[:80]
            findings.append(f"{rel_path}:{line_no} [Hardcoded Config Address] {hit}")


def audit_env_example_line(rel_path: str, line_no: int, raw_line: str, findings: list) -> None:
    """
    Làm gì: Xác minh tệp *.env.example chỉ chứa tên biến với vế phải rỗng, không chứa giá trị hay bí mật.
    Vào: rel_path, line_no, raw_line, findings.
    Ra: Thêm lỗi vào findings nếu biến có giá trị sau dấu '='.
    Gọi bởi: audit_file_for_t23().
    """
    stripped = raw_line.strip()
    if not stripped or stripped.startswith("#"):
        return

    match = ENV_ASSIGNMENT_REGEX.match(stripped)
    # Bắt mọi dòng gán giá trị khác rỗng sau dấu '='
    if match and match.group(2).strip() != "":
        findings.append(f"{rel_path}:{line_no} [Non-Empty .env.example Value] {match.group(1)}=...")


def audit_source_code_line(rel_path: str, line_no: int, raw_line: str, ext: str, findings: list) -> None:
    """
    Làm gì: Quét mã nguồn ứng dụng di động và mã chính backend Java để phát hiện địa chỉ máy chủ hoặc fallback bí mật viết cứng.
    Vào: rel_path, line_no, raw_line, ext, findings.
    Ra: Ghi nhận lỗi vào findings nếu có URL/IP viết cứng hoặc @Value chứa giá trị mặc định bí mật.
    Gọi bởi: audit_file_for_t23().
    """
    stripped = raw_line.strip()
    # Kiểm tra Java @Value("${...:<default>}") xem có mặc định bí mật hay endpoint viết cứng không
    if ext == ".java":
        for val_match in JAVA_VALUE_DEFAULT_REGEX.finditer(raw_line):
            prop_key = val_match.group(1).lower()
            default_val = val_match.group(2).strip()
            if default_val and any(s in prop_key for s in SENSITIVE_PROP_KEYS):
                findings.append(
                    f"{rel_path}:{line_no} [Java @Value Hardcoded Fallback] {val_match.group(1)} mặc định='{default_val}'"
                )

    # Bỏ qua dòng chú thích thuần túy khi kiểm tra URL mẫu trong tài liệu Javadoc/TSDoc
    if is_comment_line(stripped, ext):
        return

    # Kiểm tra URL HTTP/HTTPS có hostname hoặc IPv4:Port viết cứng trong mã thực thi / JSON EAS
    url_match = HARDCODED_URL_REGEX.search(raw_line)
    if url_match:
        findings.append(f"{rel_path}:{line_no} [Hardcoded Server URL in Code] {url_match.group(0)[:80]}")

    ip_match = HARDCODED_IPV4_PORT_REGEX.search(raw_line)
    if ip_match:
        findings.append(f"{rel_path}:{line_no} [Hardcoded IP:Port in Code] {ip_match.group(0)}")


def should_audit_file(rel_path: str) -> str | None:
    """
    Làm gì: Phân loại tệp trong cây thư mục làm việc theo 3 nhóm phạm vi T23.1 hoặc bỏ qua nếu không thuộc phạm vi.
    Vào: rel_path (đường dẫn tương đối dạng POSIX).
    Ra: 'yaml_config' | 'env_example' | 'source_code' | None.
    Gọi bởi: audit_workspace_configs_and_code().
    """
    base_name = os.path.basename(rel_path)

    # Nhóm 1: Toàn bộ tệp application*.yml/yaml/properties và docker-compose*.yml/yaml
    if (
        (base_name.startswith("application") and base_name.endswith((".yml", ".yaml", ".properties")))
        or (base_name.startswith("docker-compose") and base_name.endswith((".yml", ".yaml")))
    ):
        return "yaml_config"

    # Nhóm 2: Toàn bộ tệp mẫu biến môi trường .env.example
    if base_name == ".env.example":
        return "env_example"

    # Nhóm 3: Mã nguồn ứng dụng mobile (trừ unit test/mock) và mã chính backend Java
    if "/__tests__/" in f"/{rel_path}" or "/test-mocks/" in f"/{rel_path}":
        return None

    is_mobile_entry = rel_path in (
        "apps/mobile/app.config.ts",
        "apps/mobile/eas.json",
        "apps/mobile/App.tsx",
    )
    is_mobile_src = rel_path.startswith("apps/mobile/src/") and rel_path.endswith((".ts", ".tsx", ".js", ".json"))
    is_backend_main = rel_path.startswith("apps/backend/src/main/") and rel_path.endswith((".java", ".kt"))

    if is_mobile_entry or is_mobile_src or is_backend_main:
        return "source_code"

    return None


def audit_workspace_configs_and_code(root_dir: str) -> dict:
    """
    Làm gì: Quét toàn bộ thư mục làm việc theo yêu cầu T23.1 (tệp nhạy cảm untracked, application*.yml,
            docker-compose*.yml, *.env.example, mã app mobile và mã backend src/main).
    Vào: root_dir (thư mục gốc cần kiểm toán).
    Ra: Từ điển gồm { scanned_files: int, findings: list[str] }.
    Gọi bởi: main().
    """
    findings = []
    scanned_files = 0

    # Bước 1: Duyệt cây thư mục làm việc, cắt tỉa sớm node_modules/.git/target/dist/.expo
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in sorted(dirnames) if d not in PRUNE_DIRS]
        for fn in sorted(filenames):
            full_path = os.path.join(dirpath, fn)
            rel_path = normalize_rel_path(full_path, root_dir)

            # Kiểm tra tên tệp nhạy cảm trên ổ đĩa (chống sót tệp chưa track nằm trong thư mục dự án)
            for pat in SENSITIVE_FILENAME_PATTERNS:
                if pat.match(fn):
                    findings.append(f"{rel_path} [Sensitive Filename] Khớp mẫu '{pat.pattern}'")

            category = should_audit_file(rel_path)
            if category is None:
                continue

            scanned_files += 1
            ext = os.path.splitext(fn)[1].lower()
            is_compose = fn.startswith("docker-compose")
            is_test_resource = "/src/test/resources/" in f"/{rel_path}"

            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    for line_no, raw_line in enumerate(f, 1):
                        # Quét mẫu bí mật cổ điển trên mọi dòng thuộc phạm vi kiểm toán
                        check_classic_secret_patterns(rel_path, line_no, raw_line, findings)

                        # Phân nhánh kiểm tra đặc thù theo loại tệp
                        if category == "yaml_config":
                            audit_yaml_config_line(
                                rel_path, line_no, raw_line, is_compose, is_test_resource, findings
                            )
                        elif category == "env_example":
                            audit_env_example_line(rel_path, line_no, raw_line, findings)
                        elif category == "source_code":
                            audit_source_code_line(rel_path, line_no, raw_line, ext, findings)
            except OSError as exc:
                findings.append(f"{rel_path} [Read Error] Không thể đọc tệp: {exc}")

    return {"scanned_files": scanned_files, "findings": findings}


def scan_git_history() -> dict:
    """
    Làm gì: Quét toàn bộ lịch sử commit Git (mọi nhánh) và danh sách tệp đang theo dõi để chặn rò rỉ lịch sử.
    Vào: Không nhận tham số; chạy trên repo Git hiện tại.
    Ra: Từ điển chứa { commit_count, file_findings, working_tree_findings, content_findings }.
    Gọi bởi: main() khi không truyền cờ --skip-git.
    """
    rev_list_proc = subprocess.run(["git", "rev-list", "--all"], capture_output=True, text=True, encoding="utf-8")
    commits = [c.strip() for c in rev_list_proc.stdout.splitlines() if c.strip()]

    file_findings = []
    content_findings = []

    # Quét tên tệp từng xuất hiện trong toàn bộ lịch sử Git
    tree_files_proc = subprocess.run(
        ["git", "log", "--all", "--full-history", "--name-only", "--pretty=format:COMMIT:%H"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    current_commit = "unknown"
    for line in tree_files_proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("COMMIT:"):
            current_commit = line.replace("COMMIT:", "")
        else:
            base_name = os.path.basename(line)
            for pat in SENSITIVE_FILENAME_PATTERNS:
                if pat.match(base_name):
                    file_findings.append((current_commit, line, f"Tên tệp nhạy cảm khớp {pat.pattern}"))

    # Quét nội dung diff từng dòng thêm mới trong toàn bộ lịch sử Git
    diff_proc = subprocess.run(
        ["git", "log", "-p", "--all", "--full-history"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    current_commit = "unknown"
    current_file = "unknown"

    for line in diff_proc.stdout.splitlines():
        if line.startswith("commit "):
            current_commit = line.split()[1]
        elif line.startswith("diff --git "):
            parts = line.split()
            current_file = parts[-1] if len(parts) >= 4 else "unknown"
        elif line.startswith("+") and not line.startswith("+++"):
            added_content = line[1:].strip()
            if added_content.startswith("//") and "password" not in added_content.lower():
                continue
            for pat_name, pattern in PATTERNS.items():
                match = pattern.search(added_content)
                if match:
                    content_findings.append({
                        "commit": current_commit,
                        "file": current_file,
                        "type": pat_name,
                        "matched": match.group(0)[:40] + ("..." if len(match.group(0)) > 40 else ""),
                        "line": added_content[:80],
                    })

    # Quét danh sách tệp đang được theo dõi trong Git index
    ls_files = subprocess.run(["git", "ls-files"], capture_output=True, text=True, encoding="utf-8").stdout.splitlines()
    working_tree_findings = []
    for f in ls_files:
        base_name = os.path.basename(f)
        for pat in SENSITIVE_FILENAME_PATTERNS:
            if pat.match(base_name):
                working_tree_findings.append((f, f"Tệp nhạy cảm khớp {pat.pattern}"))

    return {
        "commit_count": len(commits),
        "file_findings": file_findings,
        "working_tree_findings": working_tree_findings,
        "content_findings": content_findings,
    }


def main(argv: list[str] | None = None) -> int:
    """
    Làm gì: Điều phối chạy đầy đủ kiểm toán lịch sử Git và kiểm toán cấu hình/mã nguồn T23.1.
    Vào: argv (tham số dòng lệnh, hỗ trợ --audit-dir và --skip-git).
    Ra: Mã thoát 0 nếu sạch hoàn toàn; 1 nếu phát hiện ít nhất một bí mật hoặc địa chỉ viết cứng.
    Gọi bởi: Khối __main__ khi thực thi script trực tiếp.
    """
    parser = argparse.ArgumentParser(description="Quét bí mật & cấu hình cứng cook-assistant (T-INFRA + T23.1)")
    parser.add_argument("--audit-dir", default=".", help="Thư mục gốc cần kiểm toán tệp cấu hình và mã nguồn")
    parser.add_argument("--skip-git", action="store_true", help="Bỏ qua quét lịch sử Git (chỉ quét thư mục mục tiêu)")
    args = parser.parse_args(argv)

    print("=" * 72)
    print("KIỂM TOÁN BÍ MẬT & ĐỊA CHỈ VIẾT CỨNG (GIT + WORKING TREE CONFIG/CODE)")
    print("=" * 72)

    git_issues = 0
    if not args.skip_git:
        git_res = scan_git_history()
        print(f"Tổng số commit Git được quét: {git_res['commit_count']}")

        print("\n--- [1/3] QUÉT TÊN TỆP NHẠY CẢM TRONG LỊCH SỬ GIT ---")
        if git_res["file_findings"]:
            print(f"PHÁT HIỆN {len(git_res['file_findings'])} tệp nhạy cảm trong lịch sử commit:")
            for cf, path_item, reason in git_res["file_findings"]:
                print(f"  - Commit {cf[:8]}: {path_item} ({reason})")
        else:
            print("  Sạch: Không phát hiện tệp .env, *.pem, *.key, *.keystore trong lịch sử Git.")

        print("\n--- [2/3] QUÉT TỆP ĐANG TRACK TRONG GIT WORKING TREE ---")
        if git_res["working_tree_findings"]:
            print(f"PHÁT HIỆN {len(git_res['working_tree_findings'])} tệp:")
            for path_item, reason in git_res["working_tree_findings"]:
                print(f"  - {path_item}: {reason}")
        else:
            print("  Sạch: Không có tệp nhạy cảm nào đang được Git theo dõi.")

        print("\n--- [3/3] QUÉT KHÓA, TOKEN, BÍ MẬT TRONG TOÀN BỘ GIT DIFF ---")
        if git_res["content_findings"]:
            print(f"CẢNH BÁO: Phát hiện {len(git_res['content_findings'])} điểm nghi vấn:")
            for item in git_res["content_findings"]:
                print(f"  - Commit {item['commit'][:8]} | File: {item['file']} | Loại: {item['type']}")
                print(f"    Giá trị: {item['matched']}")
        else:
            print("  Sạch: Không tìm thấy khóa bí mật, token hay mật khẩu nào trong toàn bộ diff.")

        git_issues = (
            len(git_res["file_findings"])
            + len(git_res["working_tree_findings"])
            + len(git_res["content_findings"])
        )

    audit_root = os.path.abspath(args.audit_dir)
    workspace_res = audit_workspace_configs_and_code(audit_root)
    print(f"\n--- [T23.1] KIỂM TOÁN application*.yml, docker-compose*.yml, *.env.example, MÃ APP & BACKEND ---")
    print(f"Thư mục kiểm toán: {audit_root} | Số tệp trong phạm vi quét: {workspace_res['scanned_files']}")
    if workspace_res["findings"]:
        print(f"PHÁT HIỆN {len(workspace_res['findings'])} vi phạm cấu hình / địa chỉ viết cứng:")
        for violation in workspace_res["findings"]:
            print(f"  - {violation}")
    else:
        print("  Sạch: Không còn khóa, mật khẩu hay địa chỉ máy chủ viết cứng trong cấu hình & mã nguồn.")

    total_issues = git_issues + len(workspace_res["findings"])
    print("\n" + "=" * 72)
    if total_issues == 0:
        print("KẾT LUẬN: TOÀN BỘ LỊCH SỬ VÀ CẤU HÌNH / MÃ NGUỒN SẠCH HOÀN TOÀN (CLEAN).")
        print("=" * 72)
        return 0

    print(f"KẾT LUẬN: PHÁT HIỆN {total_issues} VI PHẠM CẦN XỬ LÝ.")
    print("=" * 72)
    return 1


if __name__ == "__main__":
    sys.exit(main())
