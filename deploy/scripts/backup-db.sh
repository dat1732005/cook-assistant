#!/usr/bin/env bash
# ==============================================================================
# File: deploy/scripts/backup-db.sh
# Làm gì: Sao lưu cơ sở dữ liệu PostgreSQL bằng pg_dump (nén gzip + checksum SHA-256 + xoay vòng) (T21.5).
#         Hỗ trợ cả hai hướng:
#         - Mặc định (VPS Docker Compose): chạy pg_dump bên trong container service postgres.
#         - Hướng Managed DB (--external): chạy pg_dump trực tiếp tới SPRING_DATASOURCE_URL ngoài.
# Cách dùng:
#   ./deploy/scripts/backup-db.sh
#   ./deploy/scripts/backup-db.sh --external
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
MODE="compose"

for arg in "$@"; do
  case "${arg}" in
    --external)
      MODE="external"
      ;;
    --compose)
      MODE="compose"
      ;;
    -h|--help)
      echo "Cach dung: $0 [--compose | --external]"
      exit 0
      ;;
    *)
      echo "Tham so khong hop le: ${arg}" >&2
      exit 1
      ;;
  esac
done

# Nạp biến môi trường từ file .env nếu tồn tại (không lỗi nếu biến đã xuất qua shell/CI/PaaS)
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}" || true

TIMESTAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/cook_backup_${TIMESTAMP}.sql.gz"
TMP_FILE="${OUT_FILE}.tmp"

cleanup_tmp() {
  rm -f "${TMP_FILE}"
}
trap cleanup_tmp EXIT

echo "[backup-db] Bat dau sao luu PostgreSQL (che do=${MODE}) luc ${TIMESTAMP}..."

if [[ "${MODE}" == "external" ]]; then
  command -v pg_dump >/dev/null 2>&1 || { echo "Loi: Chua cai dat pg_dump tren may." >&2; exit 1; }
  RAW_JDBC="${SPRING_DATASOURCE_URL:-}"
  if [[ -z "${RAW_JDBC}" ]]; then
    echo "Loi: Che do --external yeu cau SPRING_DATASOURCE_URL." >&2
    exit 1
  fi
  # Chuyen jdbc:postgresql://... thanh postgresql://... chuan libpq cho pg_dump
  PG_URI="${RAW_JDBC#jdbc:}"
  export PGPASSWORD="${SPRING_DATASOURCE_PASSWORD:-}"
  if [[ -n "${SPRING_DATASOURCE_USERNAME:-}" ]]; then
    pg_dump --clean --if-exists --no-owner --no-acl -U "${SPRING_DATASOURCE_USERNAME}" "${PG_URI}" | gzip -9 > "${TMP_FILE}"
  else
    pg_dump --clean --if-exists --no-owner --no-acl "${PG_URI}" | gzip -9 > "${TMP_FILE}"
  fi
  unset PGPASSWORD
else
  DB_NAME="${POSTGRES_DB:-cook_assistant}"
  DB_USER="${POSTGRES_USER:-cook_user}"
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-acl \
    | gzip -9 > "${TMP_FILE}"
fi

# Kiểm tra tính toàn vẹn file nén trước khi chốt
if [[ ! -s "${TMP_FILE}" ]]; then
  echo "Loi: Tep sao luu rong sau khi pg_dump." >&2
  exit 1
fi
gzip -t "${TMP_FILE}"

mv "${TMP_FILE}" "${OUT_FILE}"
chmod 600 "${OUT_FILE}" || true

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$(dirname "${OUT_FILE}")" && sha256sum "$(basename "${OUT_FILE}")" > "$(basename "${OUT_FILE}").sha256")
  chmod 600 "${OUT_FILE}.sha256" || true
fi

# Dọn dẹp bản sao lưu cũ hơn RETENTION_DAYS ngày để tránh đầy ổ đĩa VPS
find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name "cook_backup_*.sql.gz" -o -name "cook_backup_*.sql.gz.sha256" \) -mtime "+${RETENTION_DAYS}" -delete

echo "[backup-db] Sao luu thanh cong: ${OUT_FILE} ($(du -h "${OUT_FILE}" | cut -f1))"

