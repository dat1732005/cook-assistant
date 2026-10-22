"""Script quét bí mật (secret scanning) trên toàn bộ lịch sử Git và cây thư mục của cook-assistant.
Chạy: python scripts/scan-secrets.py
"""

import os
import re
import subprocess
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Các mẫu regex nhận diện khóa, token và bí mật phổ biến
PATTERNS = {
    "Private Key Block": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----", re.I),
    "GitHub Token": re.compile(r"(?:ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{20,}", re.I),
    "AWS Access Key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "Google API Key": re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b"),
    "OpenAI / Anthropic Secret Key": re.compile(r"\bsk-[a-zA-Z0-9_-]{20,}\b"),
    "Slack Token": re.compile(r"\bxox[baprs]-[0-9a-zA-Z]{10,}\b"),
    "Stripe Secret Key": re.compile(r"\b[sr]k_live_[0-9a-zA-Z]{24,}\b"),
    "Hardcoded Password/Secret": re.compile(r"""(?:password|secret_key|api_key|token)\s*[:=]\s*["'][a-zA-Z0-9@#$%^&*!_-]{8,}["']""", re.I),
    "JWT Bearer Token": re.compile(r"\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b"),
}

# Các phần mở rộng và mẫu tên file nhạy cảm
SENSITIVE_FILENAME_PATTERNS = [
    re.compile(r"^\.env.*", re.I),
    re.compile(r".*\.pem$", re.I),
    re.compile(r".*\.key$", re.I),
    re.compile(r".*\.keystore$", re.I),
    re.compile(r".*\.jks$", re.I),
    re.compile(r".*\.p12$", re.I),
    re.compile(r".*\.pfx$", re.I),
    re.compile(r"^id_rsa.*", re.I),
    re.compile(r"^id_ed25519.*", re.I),
    re.compile(r".*credentials\.json$", re.I),
]

def scan_git_history():
    print("=" * 60)
    print("BẮT ĐẦU QUÉT BÍ MẬT TRÊN TOÀN BỘ LỊCH SỬ GIT (ALL COMMITS & ALL BRANCHES)")
    print("=" * 60)

    # 1. Kiểm tra danh sách file từng commit trong lịch sử
    rev_list_proc = subprocess.run(["git", "rev-list", "--all"], capture_output=True, text=True, encoding="utf-8")
    commits = [c.strip() for c in rev_list_proc.stdout.splitlines() if c.strip()]
    print(f"Tổng số commit được quét: {len(commits)}")

    file_findings = []
    content_findings = []

    # 2. Quét tên file từng xuất hiện trong toàn bộ lịch sử git
    tree_files_proc = subprocess.run(["git", "log", "--all", "--full-history", "--name-only", "--pretty=format:COMMIT:%H"],
                                     capture_output=True, text=True, encoding="utf-8", errors="ignore")
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

    # 3. Quét nội dung diff của toàn bộ lịch sử (git log -p --all)
    diff_proc = subprocess.run(["git", "log", "-p", "--all", "--full-history"],
                               capture_output=True, text=True, encoding="utf-8", errors="ignore")
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
            # Bỏ qua các dòng chú thích hoặc tài liệu nói về tên biến
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
                        "line": added_content[:80]
                    })

    # 4. Quét cây làm việc hiện tại (working tree)
    ls_files = subprocess.run(["git", "ls-files"], capture_output=True, text=True, encoding="utf-8").stdout.splitlines()
    working_tree_findings = []
    for f in ls_files:
        base_name = os.path.basename(f)
        for pat in SENSITIVE_FILENAME_PATTERNS:
            if pat.match(base_name):
                working_tree_findings.append((f, f"Tệp nhạy cảm khớp {pat.pattern}"))

    # Báo cáo kết quả
    print("\n--- KẾT QUẢ QUÉT TÊN TỆP NHẠY CẢM TRONG LỊCH SỬ ---")
    if file_findings:
        print(f"PHÁT HIỆN {len(file_findings)} tệp nhạy cảm trong lịch sử commit:")
        for cf, path, reason in file_findings:
            print(f"  - Commit {cf[:8]}: {path} ({reason})")
    else:
        print("  Không phát hiện tệp nhạy cảm (.env, *.pem, *.key, *.keystore, v.v.) trong lịch sử Git.")

    print("\n--- KẾT QUẢ QUÉT TỆP NHẠY CẢM TRONG WORKING TREE HIỆN TẠI ---")
    if working_tree_findings:
        print(f"PHÁT HIỆN {len(working_tree_findings)} tệp:")
        for path, reason in working_tree_findings:
            print(f"  - {path}: {reason}")
    else:
        print("  Không có tệp nhạy cảm nào đang được track trong git working tree.")

    print("\n--- KẾT QUẢ QUÉT NỘI DUNG (KHÓA, TOKEN, BÍ MẬT) TRONG GIT DIFF ---")
    if content_findings:
        print(f"CẢNH BÁO: Phát hiện {len(content_findings)} điểm nghi vấn:")
        for item in content_findings:
            print(f"  - Commit {item['commit'][:8]} | File: {item['file']} | Loại: {item['type']}")
            print(f"    Giá trị: {item['matched']}")
    else:
        print("  Không tìm thấy private key, GitHub token, AWS key, API key hoặc password nào trong toàn bộ diff.")

    total_issues = len(file_findings) + len(working_tree_findings) + len(content_findings)
    print("\n" + "=" * 60)
    if total_issues == 0:
        print("KẾT LUẬN: TOÀN BỘ LỊCH SỬ VÀ WORKING TREE SẠCH HOÀN TOÀN (CLEAN).")
        print("Không có khóa bí mật, token hay file nhạy cảm nào bị commit.")
        print("=" * 60)
        return 0
    else:
        print(f"KẾT LUẬN: PHÁT HIỆN {total_issues} VẤN ĐỀ CẦN XỬ LÝ.")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(scan_git_history())
