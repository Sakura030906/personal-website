import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    ArticleColumn, ArticleNode, ContentEntry, Document, DocumentNode,
    KnowledgeColumnNode, KnowledgeNode,
)
from .schemas import RetrievalScope


def _metadata(raw: str) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


class RetrievalScopeFilter:
    """Resolve a selected scope into its directly connected public content IDs."""

    def __init__(self, session: Session, scope: RetrievalScope | None = None):
        self.scope = scope or RetrievalScope()
        self.entity_types = set(self.scope.entity_types)
        self.has_targets = any((
            self.scope.column_ids, self.scope.node_ids,
            self.scope.article_ids, self.scope.document_ids,
        ))
        self.node_ids = set(self.scope.node_ids)
        self.article_ids = set(self.scope.article_ids)
        self.document_ids = set(self.scope.document_ids)

        column_ids = set(self.scope.column_ids)
        if column_ids:
            self.node_ids.update(session.scalars(select(KnowledgeColumnNode.node_id).where(
                KnowledgeColumnNode.column_id.in_(column_ids),
            )))
            self.article_ids.update(session.scalars(select(ArticleColumn.article_id).where(
                ArticleColumn.column_id.in_(column_ids),
            )))
            self.document_ids.update(session.scalars(select(Document.id).where(
                Document.column_id.in_(column_ids),
            )))

        if self.scope.include_graph_neighbors:
            changed = True
            while changed:
                before = (len(self.node_ids), len(self.article_ids), len(self.document_ids))
                if self.node_ids:
                    self.article_ids.update(session.scalars(select(ArticleNode.article_id).where(
                        ArticleNode.node_id.in_(self.node_ids),
                    )))
                    self.document_ids.update(session.scalars(select(DocumentNode.document_id).where(
                        DocumentNode.node_id.in_(self.node_ids),
                    )))
                if self.article_ids:
                    self.node_ids.update(session.scalars(select(ArticleNode.node_id).where(
                        ArticleNode.article_id.in_(self.article_ids),
                    )))
                if self.document_ids:
                    self.node_ids.update(session.scalars(select(DocumentNode.node_id).where(
                        DocumentNode.document_id.in_(self.document_ids),
                    )))
                changed = before != (len(self.node_ids), len(self.article_ids), len(self.document_ids))

    def allows_type(self, entity_type: str) -> bool:
        return not self.entity_types or entity_type in self.entity_types

    def allows_entry(self, entry: ContentEntry) -> bool:
        if not self.allows_type(entry.entity_type):
            return False
        if not self.has_targets:
            return True
        if entry.entity_type != "post":
            return False
        article_id = _metadata(entry.metadata_json).get("sourceArticleId")
        return str(article_id).isdigit() and int(article_id) in self.article_ids

    def allows_node(self, node: KnowledgeNode) -> bool:
        return self.allows_type("knowledge_node") and (not self.has_targets or node.id in self.node_ids)

    def allows_document(self, document: Document) -> bool:
        return self.allows_type("document") and (not self.has_targets or document.id in self.document_ids)

    def payload(self) -> dict:
        return {
            **self.scope.model_dump(),
            "resolved_node_ids": sorted(self.node_ids),
            "resolved_article_ids": sorted(self.article_ids),
            "resolved_document_ids": sorted(self.document_ids),
        }
