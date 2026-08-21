"""High-Performance Enterprise Database Service for Neon Serverless PostgreSQL with Async Background Persistence."""
import os
import json
import sqlite3
import logging
import threading
import queue
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "dealroom.db")

class DatabaseService:
    """Ultra-low-latency Non-Blocking Database Engine for Neon PostgreSQL Cloud and SQLite."""

    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        self.is_postgres = bool(self.database_url and ("postgres://" in self.database_url or "postgresql://" in self.database_url))
        self._pg_conn = None
        self._lock = threading.Lock()
        self._init_db()

        # Background async worker queue for zero-latency turn processing
        self._task_queue = queue.Queue()
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()

    def _get_connection(self):
        if self.is_postgres:
            try:
                import psycopg2
                if self._pg_conn is None or self._pg_conn.closed:
                    self._pg_conn = psycopg2.connect(self.database_url, sslmode="require")
                return self._pg_conn
            except Exception as e:
                logger.warning(f"Neon connection notice ({e}), falling back to SQLite.")
                self.is_postgres = False

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initialize database schema with tables for sessions, turns, contracts, and audit trails."""
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Sessions table
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    subject TEXT NOT NULL,
                    currency TEXT NOT NULL DEFAULT '$',
                    agent_a_role TEXT NOT NULL,
                    agent_b_role TEXT NOT NULL,
                    agent_a_ideal REAL,
                    agent_a_min REAL,
                    agent_b_ideal REAL,
                    agent_b_min REAL,
                    max_turns INTEGER DEFAULT 8,
                    deliverables TEXT,
                    deal_reached INTEGER DEFAULT 0,
                    final_amount REAL,
                    deal_quality_score REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """)

                # Turns table
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS turns (
                    id SERIAL PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    turn_number INTEGER NOT NULL,
                    agent TEXT NOT NULL,
                    message TEXT NOT NULL,
                    offer_amount REAL,
                    confidence REAL,
                    is_accepted INTEGER DEFAULT 0,
                    is_walkaway INTEGER DEFAULT 0,
                    reasoning TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """ if self.is_postgres else """
                CREATE TABLE IF NOT EXISTS turns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    turn_number INTEGER NOT NULL,
                    agent TEXT NOT NULL,
                    message TEXT NOT NULL,
                    offer_amount REAL,
                    confidence REAL,
                    is_accepted INTEGER DEFAULT 0,
                    is_walkaway INTEGER DEFAULT 0,
                    reasoning TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """)

                # Contracts table
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS contracts (
                    contract_ref TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    contract_type TEXT NOT NULL,
                    final_amount REAL,
                    currency TEXT NOT NULL,
                    markdown_content TEXT NOT NULL,
                    sha256_hash TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'SIGNED',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """)

                # Audit logs table
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    block_id SERIAL PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    prev_hash TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    block_hash TEXT NOT NULL
                )
                """ if self.is_postgres else """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    block_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    prev_hash TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    block_hash TEXT NOT NULL
                )
                """)

                conn.commit()
                if not self.is_postgres:
                    conn.close()

                provider = "Neon Serverless PostgreSQL (AWS us-east-2)" if self.is_postgres else f"SQLite ({self.db_path})"
                logger.info(f"🏛️ DealRoom Database initialized — Provider: {provider}")
        except Exception as e:
            logger.error(f"Database init exception: {e}")

    def _worker_loop(self):
        """Background thread executing async DB writes with zero latency impact on live audio stream."""
        while True:
            try:
                task = self._task_queue.get()
                if task is None:
                    break
                fn, args = task
                fn(*args)
                self._task_queue.task_done()
            except Exception as e:
                logger.warning(f"Background DB worker notice: {e}")

    def _exec_save_session(self, session_id: str, setup: Any):
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                delivs = getattr(setup, "deliverables", []) or []
                ph = "%s" if self.is_postgres else "?"
                cursor.execute(f"""
                INSERT INTO sessions (
                    session_id, subject, currency, agent_a_role, agent_b_role,
                    agent_a_ideal, agent_a_min, agent_b_ideal, agent_b_min,
                    max_turns, deliverables
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                ON CONFLICT (session_id) DO NOTHING
                """, (
                    session_id,
                    setup.subject,
                    setup.currency or "$",
                    setup.agent_a_config.role_name,
                    setup.agent_b_config.role_name,
                    setup.agent_a_config.ideal_price,
                    setup.agent_a_config.min_price,
                    setup.agent_b_config.ideal_price,
                    setup.agent_b_config.min_price,
                    setup.max_turns,
                    json.dumps(delivs)
                ))
                conn.commit()
                if not self.is_postgres:
                    conn.close()
        except Exception as e:
            logger.warning(f"_exec_save_session: {e}")

    def save_session(self, session_id: str, setup: Any) -> None:
        """Queue session persistence non-blockingly."""
        self._task_queue.put((self._exec_save_session, (session_id, setup)))

    def _exec_save_turn(self, session_id: str, turn: Any):
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                ph = "%s" if self.is_postgres else "?"
                cursor.execute(f"""
                INSERT INTO turns (
                    session_id, turn_number, agent, message, offer_amount,
                    confidence, is_accepted, is_walkaway, reasoning
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                """, (
                    session_id,
                    turn.turn_number,
                    turn.agent,
                    turn.message,
                    turn.offer_amount,
                    turn.confidence,
                    1 if turn.is_accepted else 0,
                    1 if turn.is_walkaway else 0,
                    turn.reasoning or ""
                ))
                conn.commit()
                if not self.is_postgres:
                    conn.close()
        except Exception as e:
            logger.warning(f"_exec_save_turn: {e}")

    def save_turn(self, session_id: str, turn: Any) -> None:
        """Queue turn persistence non-blockingly."""
        self._task_queue.put((self._exec_save_turn, (session_id, turn)))

    def _exec_update_outcome(self, session_id: str, deal_reached: bool, final_amount: Optional[float], quality_score: Optional[float]):
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                ph = "%s" if self.is_postgres else "?"
                cursor.execute(f"""
                UPDATE sessions SET
                    deal_reached = {ph},
                    final_amount = {ph},
                    deal_quality_score = {ph},
                    updated_at = CURRENT_TIMESTAMP
                WHERE session_id = {ph}
                """, (
                    1 if deal_reached else 0,
                    final_amount,
                    quality_score,
                    session_id
                ))
                conn.commit()
                if not self.is_postgres:
                    conn.close()
        except Exception as e:
            logger.warning(f"_exec_update_outcome: {e}")

    def update_session_outcome(self, session_id: str, deal_reached: bool, final_amount: Optional[float], quality_score: Optional[float]) -> None:
        """Queue outcome update non-blockingly."""
        self._task_queue.put((self._exec_update_outcome, (session_id, deal_reached, final_amount, quality_score)))

    def _exec_save_contract(self, contract_ref: str, session_id: str, contract_type: str, final_amount: float, currency: str, markdown: str, sha256: str):
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                ph = "%s" if self.is_postgres else "?"
                cursor.execute(f"""
                INSERT INTO contracts (
                    contract_ref, session_id, contract_type, final_amount,
                    currency, markdown_content, sha256_hash
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                ON CONFLICT (contract_ref) DO UPDATE SET markdown_content = EXCLUDED.markdown_content
                """, (
                    contract_ref, session_id, contract_type, final_amount,
                    currency, markdown, sha256
                ))
                conn.commit()
                if not self.is_postgres:
                    conn.close()
        except Exception as e:
            logger.warning(f"_exec_save_contract: {e}")

    def save_contract(self, contract_ref: str, session_id: str, contract_type: str, final_amount: float, currency: str, markdown: str, sha256: str) -> None:
        """Queue contract persistence non-blockingly."""
        self._task_queue.put((self._exec_save_contract, (contract_ref, session_id, contract_type, final_amount, currency, markdown, sha256)))

    def _exec_save_audit_event(self, session_id: str, event_type: str, timestamp: float, prev_hash: str, payload: dict, block_hash: str):
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                ph = "%s" if self.is_postgres else "?"
                cursor.execute(f"""
                INSERT INTO audit_logs (
                    session_id, event_type, timestamp, prev_hash, payload_json, block_hash
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                """, (
                    session_id, event_type, timestamp, prev_hash, json.dumps(payload), block_hash
                ))
                conn.commit()
                if not self.is_postgres:
                    conn.close()
        except Exception as e:
            logger.warning(f"_exec_save_audit_event: {e}")

    def save_audit_event(self, session_id: str, event_type: str, timestamp: float, prev_hash: str, payload: dict, block_hash: str) -> None:
        """Queue audit log non-blockingly."""
        self._task_queue.put((self._exec_save_audit_event, (session_id, event_type, timestamp, prev_hash, payload, block_hash)))

    def get_session_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent historical sessions."""
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                cursor.execute("""
                SELECT session_id, subject, currency, agent_a_role, agent_b_role,
                       agent_a_ideal, agent_b_ideal, deal_reached, final_amount,
                       deal_quality_score, created_at
                FROM sessions
                ORDER BY created_at DESC
                LIMIT %s
                """ if self.is_postgres else """
                SELECT session_id, subject, currency, agent_a_role, agent_b_role,
                       agent_a_ideal, agent_b_ideal, deal_reached, final_amount,
                       deal_quality_score, created_at
                FROM sessions
                ORDER BY created_at DESC
                LIMIT ?
                """, (limit,))
                rows = cursor.fetchall()
                if self.is_postgres:
                    cols = [desc[0] for desc in cursor.description]
                    return [dict(zip(cols, row)) for row in rows]
                res = [dict(row) for row in rows]
                conn.close()
                return res
        except Exception as e:
            logger.warning(f"get_session_history: {e}")
            return []

    def get_session_details(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full details of a specific session."""
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                ph = "%s" if self.is_postgres else "?"
                cursor.execute(f"SELECT * FROM sessions WHERE session_id = {ph}", (session_id,))
                s_row = cursor.fetchone()
                if not s_row:
                    return None
                cols = [desc[0] for desc in cursor.description]
                session_dict = dict(zip(cols, s_row)) if self.is_postgres else dict(s_row)

                cursor.execute(f"SELECT * FROM turns WHERE session_id = {ph} ORDER BY turn_number ASC", (session_id,))
                t_rows = cursor.fetchall()
                t_cols = [desc[0] for desc in cursor.description]
                session_dict["turns"] = [dict(zip(t_cols, r)) if self.is_postgres else dict(r) for r in t_rows]

                cursor.execute(f"SELECT contract_ref, contract_type, final_amount, currency, sha256_hash, created_at FROM contracts WHERE session_id = {ph}", (session_id,))
                c_rows = cursor.fetchall()
                c_cols = [desc[0] for desc in cursor.description]
                session_dict["contracts"] = [dict(zip(c_cols, r)) if self.is_postgres else dict(r) for r in c_rows]

                if not self.is_postgres:
                    conn.close()
                return session_dict
        except Exception as e:
            logger.warning(f"get_session_details: {e}")
            return None

    def get_contracts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve list of signed contracts."""
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                cursor.execute("""
                SELECT contract_ref, session_id, contract_type, final_amount,
                       currency, sha256_hash, status, created_at
                FROM contracts
                ORDER BY created_at DESC
                LIMIT %s
                """ if self.is_postgres else """
                SELECT contract_ref, session_id, contract_type, final_amount,
                       currency, sha256_hash, status, created_at
                FROM contracts
                ORDER BY created_at DESC
                LIMIT ?
                """, (limit,))
                rows = cursor.fetchall()
                cols = [desc[0] for desc in cursor.description]
                res = [dict(zip(cols, row)) if self.is_postgres else dict(row) for row in rows]
                if not self.is_postgres:
                    conn.close()
                return res
        except Exception as e:
            logger.warning(f"get_contracts: {e}")
            return []

    def get_database_analytics(self) -> Dict[str, Any]:
        """Aggregate high-level hackathon metrics across all historical negotiations."""
        try:
            with self._lock:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                cursor.execute("SELECT COUNT(*) FROM sessions")
                total_sessions = cursor.fetchone()[0] or 0

                cursor.execute("SELECT COUNT(*) FROM sessions WHERE deal_reached = 1")
                closed_deals = cursor.fetchone()[0] or 0

                cursor.execute("SELECT COUNT(*) FROM turns")
                total_turns = cursor.fetchone()[0] or 0

                cursor.execute("SELECT AVG(deal_quality_score) FROM sessions WHERE deal_quality_score IS NOT NULL AND deal_quality_score > 0")
                avg_quality = cursor.fetchone()[0] or 0.0

                cursor.execute("SELECT SUM(final_amount) FROM sessions WHERE deal_reached = 1")
                total_volume = cursor.fetchone()[0] or 0.0

                cursor.execute("SELECT COUNT(*) FROM contracts")
                total_contracts = cursor.fetchone()[0] or 0

                cursor.execute("SELECT COUNT(*) FROM audit_logs")
                total_audit_blocks = cursor.fetchone()[0] or 0

                if not self.is_postgres:
                    conn.close()

                provider = "Neon Serverless PostgreSQL (AWS us-east-2)" if self.is_postgres else "SQLite Storage"
                return {
                    "database_provider": provider,
                    "is_connected": True,
                    "total_negotiations": total_sessions,
                    "successful_agreements": closed_deals,
                    "success_rate": f"{(closed_deals / total_sessions * 100):.1f}%" if total_sessions > 0 else "0%",
                    "total_conversational_turns": total_turns,
                    "average_nash_optimality": f"{avg_quality:.1f}%",
                    "total_settled_volume": f"${total_volume:,.2f}",
                    "total_signed_contracts": total_contracts,
                    "total_audit_blocks": total_audit_blocks
                }
        except Exception as e:
            return {"database_provider": "Neon Serverless PostgreSQL", "is_connected": False, "error": str(e)}

db_service = DatabaseService()
