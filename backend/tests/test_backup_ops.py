import io
import sys
import tarfile
from pathlib import Path
from types import SimpleNamespace


BACKUP_MODULES = Path(__file__).resolve().parents[2] / "ops" / "backup"
sys.path.insert(0, str(BACKUP_MODULES))
import restore_drill  # noqa: E402


def test_restore_drill_uses_disposable_database_and_always_drops_it(tmp_path, monkeypatch):
    archive = tmp_path / "portfolio-test.tar.gz"
    with tarfile.open(archive, "w:gz") as bundle:
        data = b"fake-postgres-dump"
        info = tarfile.TarInfo("database.dump")
        info.size = len(data)
        bundle.addfile(info, io.BytesIO(data))

    calls = []

    def fake_run(command, **kwargs):
        calls.append(command)
        if command[0] == "psql":
            return SimpleNamespace(stdout="42\n", returncode=0)
        return SimpleNamespace(stdout="", returncode=0)

    monkeypatch.setenv("POSTGRES_PASSWORD", "test-password")
    monkeypatch.setattr(restore_drill, "verify", lambda _: {"valid": True})
    monkeypatch.setattr(restore_drill.subprocess, "run", fake_run)

    result = restore_drill.drill(archive)
    assert result["valid"] is True
    assert result["table_count"] == 42
    assert [command[0] for command in calls] == ["createdb", "pg_restore", "psql", "dropdb"]
    temporary_database = calls[0][-1]
    assert temporary_database.startswith("portfolio_restore_drill_")
    assert temporary_database != "portfolio"
    assert calls[-1][-1] == temporary_database
