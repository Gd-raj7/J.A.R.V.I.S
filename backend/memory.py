
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).with_name("jarvis_memory.db")


def initialize_memory():
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


def save_message(role: str, content: str):
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            "INSERT INTO messages (role, content) VALUES (?, ?)",
            (role, content)
        )


def get_recent_messages(limit: int = 20):
    with sqlite3.connect(DB_PATH) as connection:
        rows = connection.execute(
            """
            SELECT role, content
            FROM messages
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()

    return [
        {"role": role, "content": content}
        for role, content in reversed(rows)
    ]


initialize_memory()
