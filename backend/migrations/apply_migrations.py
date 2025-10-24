import os
import sys
import time
from datetime import datetime

import mysql.connector


DB_HOST = os.getenv('DATABASE_HOST', 'mysql8032')
DB_PORT = int(os.getenv('DATABASE_PORT', '3306'))
DB_USER = os.getenv('DATABASE_USER', 'root')
DB_PASS = os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD', 'P4assw@rd'))
DB_NAME = os.getenv('DATABASE_NAME', 'SystemaOllantay')

MIGRATIONS_DIR = os.path.dirname(__file__)


def connect(db: str | None = None):
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        database=db,
    )


def wait_for_mysql(timeout_sec: int = 60):
    start = time.time()
    last_err = None
    while time.time() - start < timeout_sec:
        try:
            conn = connect(None)
            conn.close()
            return True
        except Exception as e:
            last_err = e
            time.sleep(2)
    print(f"[db-init] MySQL not ready after {timeout_sec}s: {last_err}")
    return False


def ensure_database_exists():
    conn = connect(None)
    cur = conn.cursor()
    cur.execute("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=%s", (DB_NAME,))
    if not cur.fetchone():
        print(f"[db-init] Creating database {DB_NAME}...")
        cur.execute(f"CREATE DATABASE `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.commit()
    cur.close(); conn.close()


def ensure_migration_table():
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
    )
    conn.commit()
    cur.close(); conn.close()


def applied_files() -> set[str]:
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("SELECT filename FROM schema_migrations")
    rows = {r[0] for r in cur.fetchall()}
    cur.close(); conn.close()
    return rows


def run_sql_file(path: str):
    sql = open(path, 'r', encoding='utf-8').read()
    conn = connect(DB_NAME)
    try:
        # Execute statements one-by-one; ignore benign errors (idempotent)
        cur = conn.cursor()
        for statement in filter(None, [s.strip() for s in sql.split(';')]):
            st = statement.strip()
            up = st.upper()
            # Skip introspection statements and pure comments
            if not st or up.startswith('SHOW') or up.startswith('SELECT') or up.startswith('DESCRIBE') or up.startswith('EXPLAIN') or st.startswith('--') or st.startswith('/*') or st.startswith('*/'):
                continue
            try:
                cur.execute(st)
            except Exception as e:
                print(f"[db-init] Skipping statement due to error: {e}\n-- Statement:\n{st}\n")
                try:
                    while cur.nextset():
                        pass
                except Exception:
                    pass
        conn.commit()
    finally:
        try:
            cur.close()
        except Exception:
            pass
        conn.close()


def record_applied(filename: str):
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO schema_migrations (filename, applied_at) VALUES (%s, %s)",
        (filename, datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')),
    )
    conn.commit()
    cur.close(); conn.close()


def main():
    print("[db-init] Waiting for MySQL...")
    if not wait_for_mysql():
        sys.exit(1)
    ensure_database_exists()
    ensure_migration_table()

    files = [f for f in os.listdir(MIGRATIONS_DIR) if f.endswith('.sql')]
    files.sort()  # chronological by prefix
    already = applied_files()
    if not files:
        print("[db-init] No migration files found.")
        return
    for fname in files:
        if fname in already:
            print(f"[db-init] Skipping already applied: {fname}")
            continue
        full = os.path.join(MIGRATIONS_DIR, fname)
        print(f"[db-init] Applying {fname}...")
        try:
            run_sql_file(full)
            record_applied(fname)
            print(f"[db-init] Applied {fname}")
        except Exception as e:
            print(f"[db-init] ERROR applying {fname}: {e}")
            sys.exit(2)
    print("[db-init] Database is up-to-date.")


if __name__ == '__main__':
    main()
