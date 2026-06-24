#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI 登记共享核心。

被 Claude Code 的 SessionStart hook 与 Codex 的 ai_register 插件共用，
负责 SQLite 登记库的建库、身份 upsert、进度回填与只读查询。

设计要点：
- 以 session_id 为唯一主键，写操作走 upsert / 局部 UPDATE，并行不写脏。
- upsert_identity 只写"身份列"（工具/模型/resume/cwd/source），
  update_progress 只写"进度列"（task_dir/feature/progress），两者互不覆盖。
- 仅依赖 Python 标准库（sqlite3），hook 与 skill 零外部依赖。
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import datetime

# 登记库默认相对仓库根的位置：<cwd>/docs/ai-register.db
DEFAULT_DB_RELPATH = os.path.join("docs", "ai-register.db")


def now_str() -> str:
    """运行时生成的本地时间戳（脚本运行环境的系统时间）。"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def default_db_path(cwd: str | None = None) -> str:
    """根据工作目录推导默认登记库路径。"""
    base = cwd or os.getcwd()
    return os.path.join(base, DEFAULT_DB_RELPATH)


def ensure_db(db_path: str) -> sqlite3.Connection:
    """建库建表并开启 WAL，返回连接。父目录不存在时自动创建。"""
    parent = os.path.dirname(os.path.abspath(db_path))
    if parent and not os.path.isdir(parent):
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10)
    # WAL 模式：并发读写下的原子性与隔离性，缓解多会话同目录并行撞写
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_register (
          session_id   TEXT PRIMARY KEY,
          tool         TEXT,
          model        TEXT,
          resume_shell TEXT,
          resume_cli   TEXT,
          cwd          TEXT,
          task_dir     TEXT,
          feature      TEXT,
          progress     TEXT,
          source       TEXT,
          created_at   TEXT,
          updated_at   TEXT
        );
        """
    )
    conn.commit()
    return conn


def build_resume(tool: str | None, session_id: str) -> tuple[str, str]:
    """按工具拼出 (resume_shell, resume_cli)。

    - Codex      → ("codex resume <id>", "/resume")
    - 其它/默认   → Claude Code: ("claude -r <id>", "/resume <id>")
    """
    t = (tool or "").lower()
    if "codex" in t:
        return (f"codex resume {session_id}", "/resume")
    return (f"claude -r {session_id}", f"/resume {session_id}")


def upsert_identity(
    db_path: str,
    session_id: str,
    tool: str | None = None,
    model: str | None = None,
    cwd: str | None = None,
    source: str | None = None,
) -> bool:
    """写入/更新身份列（不触碰 task_dir/feature/progress）。

    session_id 为空时直接返回 False（不登记）。
    """
    if not session_id:
        return False
    resume_shell, resume_cli = build_resume(tool, session_id)
    ts = now_str()
    conn = ensure_db(db_path)
    try:
        conn.execute(
            """
            INSERT INTO ai_register
              (session_id, tool, model, resume_shell, resume_cli, cwd, source, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(session_id) DO UPDATE SET
              tool=excluded.tool,
              model=excluded.model,
              resume_shell=excluded.resume_shell,
              resume_cli=excluded.resume_cli,
              cwd=excluded.cwd,
              source=excluded.source,
              updated_at=excluded.updated_at
            """,
            (session_id, tool, model, resume_shell, resume_cli, cwd, source, ts, ts),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def update_progress(
    db_path: str,
    session_id: str,
    task_dir: str | None = None,
    feature: str | None = None,
    progress: str | None = None,
) -> bool:
    """回填进度列（task_dir/feature/progress），只更新显式给出的字段。

    若该 session 行尚不存在（skill 早于 hook 运行的罕见情况），先建占位行。
    """
    if not session_id:
        return False
    ts = now_str()
    conn = ensure_db(db_path)
    try:
        # 保证行存在，避免 skill 先于 hook 时丢更新
        conn.execute(
            "INSERT OR IGNORE INTO ai_register (session_id, created_at, updated_at) VALUES (?,?,?)",
            (session_id, ts, ts),
        )
        sets: list[str] = []
        params: list[str] = []
        if task_dir is not None:
            sets.append("task_dir=?")
            params.append(task_dir)
        if feature is not None:
            sets.append("feature=?")
            params.append(feature)
        if progress is not None:
            sets.append("progress=?")
            params.append(progress)
        sets.append("updated_at=?")
        params.append(ts)
        params.append(session_id)
        conn.execute(
            f"UPDATE ai_register SET {', '.join(sets)} WHERE session_id=?", params
        )
        conn.commit()
        return True
    finally:
        conn.close()


def query_rows(
    db_path: str,
    task_dir: str | None = None,
    keyword: str | None = None,
) -> list[dict]:
    """只读查询，返回行字典列表（按 updated_at 倒序）。库不存在时返回空。

    task_dir 为精确匹配；keyword 用于 sdlc-history 的需求历史检索，模糊匹配
    task_dir / feature / cwd / source / session_id。
    """
    if not os.path.exists(db_path):
        return []
    conn = sqlite3.connect(db_path, timeout=10)
    try:
        conn.row_factory = sqlite3.Row
        if task_dir:
            cur = conn.execute(
                "SELECT * FROM ai_register WHERE task_dir=? ORDER BY updated_at DESC",
                (task_dir,),
            )
        elif keyword:
            like = f"%{keyword}%"
            cur = conn.execute(
                """
                SELECT * FROM ai_register
                WHERE task_dir LIKE ?
                   OR feature LIKE ?
                   OR cwd LIKE ?
                   OR source LIKE ?
                   OR session_id LIKE ?
                ORDER BY updated_at DESC
                """,
                (like, like, like, like, like),
            )
        else:
            cur = conn.execute("SELECT * FROM ai_register ORDER BY updated_at DESC")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def render_table(rows: list[dict]) -> str:
    """把查询结果渲染成可读文本表格（形态 C 查询输出，不依赖 sqlite3 CLI）。"""
    if not rows:
        return "（登记库为空或不存在）"
    cols = [
        ("tool", "工具"),
        ("model", "模型"),
        ("session_id", "sessionId"),
        ("progress", "进度"),
        ("feature", "完成功能"),
        ("resume_shell", "resume(shell)"),
        ("task_dir", "任务目录"),
        ("updated_at", "更新时间"),
    ]

    def cell(row: dict, key: str) -> str:
        v = row.get(key)
        v = "" if v is None else str(v)
        # session_id 只展示前 8 位，避免表格过宽
        if key == "session_id" and len(v) > 8:
            v = v[:8]
        return v

    headers = [label for _, label in cols]
    table = [headers] + [[cell(r, k) for k, _ in cols] for r in rows]
    widths = [max(len(r[i]) for r in table) for i in range(len(cols))]

    def fmt(r: list[str]) -> str:
        return "  ".join(c.ljust(widths[i]) for i, c in enumerate(r))

    sep = "  ".join("-" * w for w in widths)
    lines = [fmt(table[0]), sep] + [fmt(r) for r in table[1:]]
    return "\n".join(lines)


def _build_cli() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="AI 登记核心 CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("upsert", help="写入/更新身份列")
    sp.add_argument("--db")
    sp.add_argument("--cwd")
    sp.add_argument("--session", required=True)
    sp.add_argument("--tool")
    sp.add_argument("--model")
    sp.add_argument("--source")

    pp = sub.add_parser("progress", help="回填进度列")
    pp.add_argument("--db")
    pp.add_argument("--cwd")
    pp.add_argument("--session", required=True)
    pp.add_argument("--task-dir")
    pp.add_argument("--feature")
    pp.add_argument("--progress")

    qp = sub.add_parser("query", help="只读查询并打印可读表格")
    qp.add_argument("--db")
    qp.add_argument("--cwd")
    qp.add_argument("--task-dir")
    qp.add_argument("--keyword", help="按需求关键词模糊匹配历史会话")
    return p


def _resolve_db(args) -> str:
    return args.db or default_db_path(getattr(args, "cwd", None))


def main(argv: list[str] | None = None) -> int:
    args = _build_cli().parse_args(argv)
    db = _resolve_db(args)
    if args.cmd == "upsert":
        ok = upsert_identity(
            db, args.session, tool=args.tool, model=args.model,
            cwd=getattr(args, "cwd", None), source=args.source,
        )
        return 0 if ok else 1
    if args.cmd == "progress":
        ok = update_progress(
            db, args.session, task_dir=args.task_dir,
            feature=args.feature, progress=args.progress,
        )
        return 0 if ok else 1
    if args.cmd == "query":
        print(render_table(query_rows(db, task_dir=args.task_dir, keyword=args.keyword)))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
