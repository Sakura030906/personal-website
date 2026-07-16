import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_session
from ..knowledge_service import NODE_SNAPSHOT_FIELDS, apply_node_payload, node_dict, payload_hash, relation_dict
from ..knowledge_rag import delete_knowledge_node_index, index_knowledge_node
from ..models import ArticleNode, ContentVersion, KnowledgeColumnNode, KnowledgeNode, KnowledgeRelation, NodeTag
from ..schemas import KnowledgeNodeWrite, KnowledgeRelationWrite
from ..security import require_admin


router = APIRouter()


def clean_node_payload(payload: KnowledgeNodeWrite) -> dict:
    return payload.model_dump(exclude={"expected_revision"})


def save_version(session: Session, entity_type: str, entity_id: int, snapshot: dict, user: str, reason: str) -> None:
    session.add(ContentVersion(
        entity_type=entity_type, entity_id=entity_id,
        snapshot_json=json.dumps(snapshot, ensure_ascii=False, sort_keys=True, default=str),
        snapshot_hash=payload_hash(snapshot), reason=reason, created_by_email=user,
    ))


@router.get("/knowledge-nodes")
def list_nodes(column_id: int | None = None, _: str = Depends(require_admin), session: Session = Depends(get_session)) -> list[dict]:
    query = select(KnowledgeNode).order_by(KnowledgeNode.updated_at.desc(), KnowledgeNode.title)
    if column_id:
        query = query.join(KnowledgeColumnNode, KnowledgeColumnNode.node_id == KnowledgeNode.id).where(KnowledgeColumnNode.column_id == column_id)
    return [node_dict(session, node) for node in session.scalars(query)]


@router.post("/knowledge-nodes")
def create_node(payload: KnowledgeNodeWrite, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    if session.scalar(select(KnowledgeNode).where(KnowledgeNode.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Knowledge node slug already exists")
    node = KnowledgeNode(title=payload.title, slug=payload.slug)
    session.add(node)
    session.flush()
    raw = clean_node_payload(payload)
    apply_node_payload(session, node, raw)
    save_version(session, "knowledge_node", node.id, raw, user, "created")
    index_knowledge_node(session, node)
    session.commit()
    session.refresh(node)
    return node_dict(session, node)


@router.patch("/knowledge-nodes/{node_id}")
def update_node(node_id: int, payload: KnowledgeNodeWrite, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    node = session.get(KnowledgeNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    if payload.expected_revision is not None and payload.expected_revision != node.revision:
        raise HTTPException(status_code=409, detail={"message": "知识节点已被修改，请刷新后重试。", "current_revision": node.revision})
    duplicate = session.scalar(select(KnowledgeNode).where(KnowledgeNode.slug == payload.slug, KnowledgeNode.id != node.id))
    if duplicate:
        raise HTTPException(status_code=409, detail="Knowledge node slug already exists")
    current = node_dict(session, node, include_relations=False)
    save_version(session, "knowledge_node", node.id, {key: current.get(key) for key in NODE_SNAPSHOT_FIELDS}, user, "manual_save")
    apply_node_payload(session, node, clean_node_payload(payload))
    node.revision += 1
    index_knowledge_node(session, node)
    session.commit()
    session.refresh(node)
    return node_dict(session, node)


@router.delete("/knowledge-nodes/{node_id}")
def delete_node(node_id: int, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    node = session.get(KnowledgeNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    save_version(session, "knowledge_node", node.id, node_dict(session, node, include_relations=False), user, "deleted")
    delete_knowledge_node_index(session, node.id)
    for model, condition in [
        (NodeTag, NodeTag.node_id == node.id), (KnowledgeColumnNode, KnowledgeColumnNode.node_id == node.id),
        (ArticleNode, ArticleNode.node_id == node.id),
        (KnowledgeRelation, or_(KnowledgeRelation.source_node_id == node.id, KnowledgeRelation.target_node_id == node.id)),
    ]:
        for row in session.scalars(select(model).where(condition)):
            session.delete(row)
    session.delete(node)
    session.commit()
    return {"status": "deleted"}


@router.get("/knowledge-nodes/{node_id}/versions")
def node_versions(node_id: int, _: str = Depends(require_admin), session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(ContentVersion).where(
        ContentVersion.entity_type == "knowledge_node", ContentVersion.entity_id == node_id,
    ).order_by(ContentVersion.id.desc()))
    return [{"id": row.id, "reason": row.reason, "created_by_email": row.created_by_email, "created_at": row.created_at} for row in rows]


@router.post("/knowledge-nodes/versions/{version_id}/restore")
def restore_node_version(version_id: int, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    version = session.get(ContentVersion, version_id)
    if not version or version.entity_type != "knowledge_node":
        raise HTTPException(status_code=404, detail="Knowledge node version not found")
    node = session.get(KnowledgeNode, version.entity_id)
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    raw = json.loads(version.snapshot_json)
    duplicate = session.scalar(select(KnowledgeNode).where(KnowledgeNode.slug == raw.get("slug"), KnowledgeNode.id != node.id))
    if duplicate:
        raise HTTPException(status_code=409, detail="Version slug is already used by another node")
    current = node_dict(session, node, include_relations=False)
    save_version(session, "knowledge_node", node.id, {key: current.get(key) for key in NODE_SNAPSHOT_FIELDS}, user, "before_restore")
    apply_node_payload(session, node, raw)
    node.revision += 1
    index_knowledge_node(session, node)
    session.commit()
    session.refresh(node)
    return node_dict(session, node)


@router.get("/knowledge-relations")
def list_relations(_: str = Depends(require_admin), session: Session = Depends(get_session)) -> list[dict]:
    return [relation_dict(session, row) for row in session.scalars(select(KnowledgeRelation).order_by(KnowledgeRelation.updated_at.desc(), KnowledgeRelation.id.desc()))]


def validate_relation(session: Session, payload: KnowledgeRelationWrite, relation_id: int | None = None) -> None:
    if payload.source_node_id == payload.target_node_id:
        raise HTTPException(status_code=422, detail="A node cannot relate to itself")
    if not session.get(KnowledgeNode, payload.source_node_id) or not session.get(KnowledgeNode, payload.target_node_id):
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    duplicate = session.scalar(select(KnowledgeRelation).where(
        KnowledgeRelation.source_node_id == payload.source_node_id,
        KnowledgeRelation.target_node_id == payload.target_node_id,
        KnowledgeRelation.relation_type == payload.relation_type,
        KnowledgeRelation.id != relation_id if relation_id else KnowledgeRelation.id > 0,
    ))
    if duplicate:
        raise HTTPException(status_code=409, detail="Knowledge relation already exists")


@router.post("/knowledge-relations")
def create_relation(payload: KnowledgeRelationWrite, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    validate_relation(session, payload)
    relation = KnowledgeRelation(**payload.model_dump())
    session.add(relation)
    session.flush()
    save_version(session, "knowledge_relation", relation.id, payload.model_dump(), user, "created")
    index_knowledge_node(session, session.get(KnowledgeNode, relation.source_node_id))
    index_knowledge_node(session, session.get(KnowledgeNode, relation.target_node_id))
    session.commit()
    session.refresh(relation)
    return relation_dict(session, relation)


@router.patch("/knowledge-relations/{relation_id}")
def update_relation(relation_id: int, payload: KnowledgeRelationWrite, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    relation = session.get(KnowledgeRelation, relation_id)
    if not relation:
        raise HTTPException(status_code=404, detail="Knowledge relation not found")
    validate_relation(session, payload, relation_id)
    save_version(session, "knowledge_relation", relation.id, relation_dict(session, relation), user, "manual_save")
    for key, value in payload.model_dump().items():
        setattr(relation, key, value)
    session.flush()
    index_knowledge_node(session, session.get(KnowledgeNode, relation.source_node_id))
    index_knowledge_node(session, session.get(KnowledgeNode, relation.target_node_id))
    session.commit()
    session.refresh(relation)
    return relation_dict(session, relation)


@router.delete("/knowledge-relations/{relation_id}")
def delete_relation(relation_id: int, user: str = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    relation = session.get(KnowledgeRelation, relation_id)
    if not relation:
        raise HTTPException(status_code=404, detail="Knowledge relation not found")
    save_version(session, "knowledge_relation", relation.id, relation_dict(session, relation), user, "deleted")
    source_node_id = relation.source_node_id
    target_node_id = relation.target_node_id
    session.delete(relation)
    session.flush()
    index_knowledge_node(session, session.get(KnowledgeNode, source_node_id))
    index_knowledge_node(session, session.get(KnowledgeNode, target_node_id))
    session.commit()
    return {"status": "deleted"}
