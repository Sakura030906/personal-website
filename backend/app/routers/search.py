from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_session
from ..knowledge_rag import search_knowledge_nodes
from ..models import SearchEvent
from ..schemas import SearchEventIn, SearchResult
from ..search import search_entries

router = APIRouter()


@router.get("", response_model=list[SearchResult])
def search(q: str, limit: int = 10, session: Session = Depends(get_session)) -> list[SearchResult]:
    results = [
        SearchResult(
            id=item.entry.id,
            entity_type=item.entry.entity_type,
            slug=item.entry.slug,
            title=item.entry.title,
            summary=item.entry.summary,
            score=item.score,
        )
        for item in search_entries(session, q, limit=limit)
    ]
    results.extend(
        SearchResult(
            id=hit.node.id,
            entity_type="knowledge_node",
            slug=hit.node.slug,
            title=hit.node.title,
            summary=hit.node.summary,
            score=hit.score,
        )
        for hit in search_knowledge_nodes(session, q, limit=limit)
    )
    results.sort(key=lambda item: item.score, reverse=True)
    return results[: max(1, min(limit, 20))]


@router.post("/events")
def record_search_event(payload: SearchEventIn, session: Session = Depends(get_session)) -> dict[str, int | str]:
    event = SearchEvent(
        session_id=payload.session_id[:120] or "default",
        source=payload.source[:80] or "command",
        event_type=payload.event_type[:40] or "search",
        query=payload.query[:255],
        result_count=max(0, payload.result_count),
        selected_type=payload.selected_type[:80],
        selected_title=payload.selected_title[:255],
        selected_href=payload.selected_href[:255],
    )
    session.add(event)
    session.commit()
    return {"id": event.id, "status": "recorded"}
