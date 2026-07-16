import json
import sys
from pathlib import Path

from sqlalchemy import or_, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.article_service import slugify
from app.database import SessionLocal, run_migrations
from app.knowledge_service import payload_hash
from app.models import ContentVersion, KnowledgeColumn, KnowledgeColumnNode, KnowledgeNode, KnowledgeRelation, NodeTag, Tag


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SITE_JSON = PROJECT_ROOT / "data" / "site.json"


def node_markdown(name: str, description: str, example: str) -> str:
    sections = [f"# {name}"]
    if description:
        sections.extend(["", description])
    if example:
        sections.extend(["", "## 示例", "", "```text", example, "```"])
    return "\n".join(sections)


def main() -> None:
    run_migrations()
    site = json.loads(SITE_JSON.read_text(encoding="utf-8"))
    created = attached = related = 0
    with SessionLocal() as session:
        columns = {column.name.lower(): column for column in session.scalars(select(KnowledgeColumn))}
        node_by_name: dict[str, KnowledgeNode] = {node.title.lower(): node for node in session.scalars(select(KnowledgeNode))}
        pending_relations: list[tuple[str, str]] = []

        for topic in site.get("knowledgeBase", []):
            column = columns.get(str(topic.get("topic") or "").strip().lower())
            if not column:
                continue
            notes = {str(note.get("name") or "").strip().lower(): note for note in topic.get("notes", [])}
            names = list(dict.fromkeys([*(topic.get("items") or []), *[note.get("name") for note in topic.get("notes", [])]]))
            for order, raw_name in enumerate(names):
                name = str(raw_name or "").strip()
                if not name:
                    continue
                note = notes.get(name.lower(), {})
                description = str(note.get("description") or "").strip()
                example = str(note.get("example") or "").strip()
                node = node_by_name.get(name.lower())
                if not node:
                    node = KnowledgeNode(
                        title=name, slug=slugify(name), summary=description,
                        content_markdown=node_markdown(name, description, example),
                        node_type="concept", importance=3, visibility="public", allow_ai_search=True,
                    )
                    session.add(node)
                    session.flush()
                    node_by_name[name.lower()] = node
                    created += 1
                link = session.scalar(select(KnowledgeColumnNode).where(
                    KnowledgeColumnNode.column_id == column.id, KnowledgeColumnNode.node_id == node.id,
                ))
                if not link:
                    session.add(KnowledgeColumnNode(column_id=column.id, node_id=node.id, is_primary=not session.scalar(select(KnowledgeColumnNode).where(KnowledgeColumnNode.node_id == node.id)), sort_order=order))
                    attached += 1
                tag = session.scalar(select(Tag).where(Tag.name == column.name))
                if not tag:
                    tag = Tag(name=column.name, slug=slugify(column.name))
                    session.add(tag)
                    session.flush()
                if not session.scalar(select(NodeTag).where(NodeTag.node_id == node.id, NodeTag.tag_id == tag.id)):
                    session.add(NodeTag(node_id=node.id, tag_id=tag.id))
                if not session.scalar(select(ContentVersion).where(ContentVersion.entity_type == "knowledge_node", ContentVersion.entity_id == node.id)):
                    initial = {
                        "title": node.title, "slug": node.slug, "summary": node.summary,
                        "content_markdown": node.content_markdown, "node_type": node.node_type,
                        "importance": node.importance, "visibility": node.visibility,
                        "allow_ai_search": node.allow_ai_search, "tag_names": [column.name],
                        "column_ids": [column.id], "primary_column_id": column.id,
                        "article_ids": [], "article_relation_type": "references",
                    }
                    session.add(ContentVersion(
                        entity_type="knowledge_node", entity_id=node.id,
                        snapshot_json=json.dumps(initial, ensure_ascii=False, sort_keys=True),
                        snapshot_hash=payload_hash(initial), reason="migration", created_by_email="migration",
                    ))
                pending_relations.extend((name.lower(), str(target).strip().lower()) for target in note.get("links", []) if str(target).strip())

        session.flush()
        for source_name, target_name in pending_relations:
            source = node_by_name.get(source_name)
            target = node_by_name.get(target_name)
            if not source or not target or source.id == target.id:
                continue
            exists = session.scalar(select(KnowledgeRelation).where(or_(
                (KnowledgeRelation.source_node_id == source.id) & (KnowledgeRelation.target_node_id == target.id),
                (KnowledgeRelation.source_node_id == target.id) & (KnowledgeRelation.target_node_id == source.id),
            ), KnowledgeRelation.relation_type == "related_to"))
            if not exists:
                session.add(KnowledgeRelation(
                    source_node_id=source.id, target_node_id=target.id,
                    relation_type="related_to", relation_label="相关知识",
                    description="由已有知识笔记中的显式链接迁移。", direction="directed",
                    is_active=True, is_public=True,
                ))
                related += 1
        session.commit()
    print(f"Knowledge nodes created: {created}; column links: {attached}; relations: {related}")


if __name__ == "__main__":
    main()
