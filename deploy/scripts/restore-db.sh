#!/usr/bin/env bash
# ==============================================================================
# File: deploy/scripts/restore-db.sh
# Làm gì: Khôi phục cơ sở dữ liệu PostgreSQL từ bản sao lưu pg_dump (T21.5).
#         Kiểm tra checksum SHA-256 + gzip trước khi ghi đè, tạm dừng container backend
#         trong lúc khôi phục (chế độ VPS Compose) để tránh khóa kết nối đang mở.
# Cách dùng:
#   ./deploy/scripts/restore-db.sh deploy/backups/cook_backup_20261109_020000Z.sql.gz [--yes]
#   ./deploy/scripts/restore-db.sh deploy/backups/cook_backup_20261109_020000Z.sql.gz --external [--yes]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env}"

BACKUP_FILE=""
MODE="compose"
AUTO_YES="false"

for arg in "$@"; do
  case "${arg}" in
    --external)
      MODE="external"
      ;;
    --compose)
      MODE="compose"
      ;;
    --yes|-y)
      AUTO_YES="true"
      ;;
    -h|--help)
      echo "Cach dung: $0 <duong-dan-file-backup.sql.gz> [--compose | --external] [--yes]"
      exit 0
      ;;
    *)
      if [[ -z "${BACKUP_FILE}" ]]; then
        BACKUP_FILE="${arg}"
      else
        echo "Tham so thua khong hop le: ${arg}" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Loi: Khong tim thay tep sao luu '${BACKUP_FILE}'." >&2
  exit 1
fi

# Kiểm tra checksum SHA-256 và cấu trúc gzip trước khi chạm vào CSDL thật
if [[ -f "${BACKUP_FILE}.sha256" ]] && command -v sha256sum >/dev/null 2>&1; then
  echo "[restore-db] Kiem tra SHA-256 checksum..."
  (cd "$(dirname "${BACKUP_FILE}")" && sha256sum -c "$(basename "${BACKUP_FILE}").sha256")
fi

if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gzip -t "${BACKUP_FILE}"
fi

if [[ "${AUTO_YES}" != "true" ]]; then
  read -r -p "CANH BAO: Thao tac se ghi de du lieu CSDL hien tai tu '${BACKUP_FILE}'. Nhap 'YES' de xac nhan: " CONFIRM
  if [[ "${CONFIRM}" != "YES" ]]; then
    echo "[restore-db] Da huy thao tac khoi phuc."
    exit 1
  fi
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

stream_sql() {
  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}"
  else
    cat "${BACKUP_FILE}"
  fi
}

echo "[restore-db] Bat dau khoi phuc (che do=${MODE}) tu '${BACKUP_FILE}'..."

if [[ "${MODE}" == "external" ]]; then
  command -v psql >/dev/null 2>&1 || { echo "Loi: Chua cai dat psql tren may." >&2; exit 1; }
  RAW_JDBC="${SPRING_DATASOURCE_URL:-}"
  if [[ -z "${RAW_JDBC}" ]]; then
    echo "Loi: Che do --external yeu cau SPRING_DATASOURCE_URL." >&2
    exit 1
  fi
  PG_URI="${RAW_JDBC#jdbc:}"
  export PGPASSWORD="${SPRING_DATASOURCE_PASSWORD:-}"
  if [[ -n "${SPRING_DATASOURCE_USERNAME:-}" ]]; then
    stream_sql | psql -v ON_ERROR_STOP=1 -U "${SPRING_DATASOURCE_USERNAME}" "${PG_URI}"
  else
    stream_sql | psql -v ON_ERROR_STOP=1 "${PG_URI}"
  fi
  unset PGPASSWORD
else
  DB_NAME="${POSTGRES_DB:-cook_assistant}"
  DB_USER="${POSTGRES_USER:-cook_user}"

  # Tạm dừng container backend (nếu đang chạy) để giải phóng kết nối HikariCP trước khi ghi đè schema
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop backend || true

  stream_sql | docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"

  echo "[restore-db] Kiem tra bang du lieu sau khoi phuc..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    psql -U "${DB_USER}" -d "${DB_NAME}" -c "\dt"

  # Khởi động lại backend; Flyway sẽ tự kiểm định schema hiện có (validate-on-migrate)
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d backend
fi

echo "[restore-db] Khoi phuc hoan tat!"

