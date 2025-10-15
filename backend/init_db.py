import os
import mysql.connector

SQL_FILE = os.path.join(os.path.dirname(__file__), 'roles.sql')

def get_conn():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST', '127.0.0.1'),
        port=int(os.getenv('DATABASE_PORT', 3306)),
        user=os.getenv('DATABASE_USER', 'root'),
        password=os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD', 'P4assw@rd')),
        database=os.getenv('DATABASE_NAME', 'SystemaOllantay')
    )

def run_sql_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        sql = f.read()
    # split by ';' naive but sufficient for simple scripts
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    conn = get_conn()
    cur = conn.cursor()
    try:
        for stmt in statements:
            try:
                cur.execute(stmt)
            except Exception as e:
                print('Statement failed:', e)
        conn.commit()
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    print('Applying', SQL_FILE)
    run_sql_file(SQL_FILE)
    print('Done')
