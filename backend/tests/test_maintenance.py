import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.maintenance import run_maintenance_cycle
from app.models import InboxItem, ProactiveTask
from app.routers.metrics import marker_age_seconds


def make_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine, Session(engine)


def test_maintenance_cycle_generates_tasks_and_atomic_state(tmp_path):
    engine, session = make_session()
    try:
        session.add(InboxItem(title="待整理", status="inbox", visibility="private"))
        session.commit()
        state_file = tmp_path / "maintenance" / "status.json"
        payload = run_maintenance_cycle(session, state_file, datetime.now(timezone.utc))
        assert payload["status"] == "ok"
        assert payload["stats"]["open_tasks"] == 1
        assert session.query(ProactiveTask).count() == 1
        stored = json.loads(state_file.read_text(encoding="utf-8"))
        assert stored["focus"] == ["整理收件箱：待整理"]
        assert not state_file.with_suffix(".json.tmp").exists()
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_marker_age_supports_plain_and_json_markers(tmp_path):
    now = datetime.now(timezone.utc)
    plain = tmp_path / "backup-success"
    plain.write_text((now - timedelta(seconds=5)).isoformat(), encoding="utf-8")
    structured = tmp_path / "maintenance.json"
    structured.write_text(json.dumps({"completed_at": (now - timedelta(seconds=8)).isoformat()}), encoding="utf-8")
    assert 0 <= marker_age_seconds(str(plain)) < 30
    assert 0 <= marker_age_seconds(str(structured)) < 30
    assert marker_age_seconds(str(tmp_path / "missing")) == -1
