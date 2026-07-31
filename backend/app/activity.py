import json

from sqlalchemy.orm import Session

from .models import ActivityEvent


def record_activity(
    session: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None,
    entity_title: str,
    actor_email: str,
    detail: dict | None = None,
) -> None:
    session.add(ActivityEvent(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_title=entity_title,
        actor_email=actor_email,
        detail_json=json.dumps(detail or {}, ensure_ascii=False, default=str),
    ))
