function graphNodeColor(type) {
  return {
    column: "#2f6fec",
    concept: "#167c55",
    article: "#2764a5",
    question: "#b06b16",
    tool: "#7b4bb7",
    project: "#b34747",
    reference: "#4d6674",
  }[type] || "#167c55";
}

const graphClusterPalette = ["#16a77b", "#397ee8", "#8d62d9", "#f39a45", "#de6572", "#39a8a1", "#6e8ed6"];

function graphColumnColor(slug = "") {
  const value = [...String(slug)].reduce((total, char) => total + char.charCodeAt(0), 0);
  return graphClusterPalette[value % graphClusterPalette.length];
}

function graphSemanticGroup(node) {
  const text = [node.title, node.summary, ...(node.tags || [])].join(" ").toLowerCase();
  const groups = [
    { key: "index", title: "索引机制", words: ["index", "hnsw", "ivf", "索引"] },
    { key: "retrieval", title: "检索与召回", words: ["search", "retrieval", "召回", "检索", "rerank", "topk"] },
    { key: "model", title: "数据模型", words: ["collection", "schema", "partition", "chunk", "document", "数据", "切分"] },
    { key: "memory", title: "状态与记忆", words: ["redis", "cache", "memory", "缓存", "状态", "锁"] },
    { key: "runtime", title: "运行与编排", words: ["agent", "tool", "workflow", "langgraph", "fastapi", "任务", "工具"] },
    { key: "foundation", title: "核心基础", words: ["embedding", "vector", "向量", "prompt", "llm", "模型"] },
  ];
  return groups.find((group) => group.words.some((word) => text.includes(word))) || { key: "concept", title: "核心概念" };
}

function renderGraphDetail(nodeData = null) {
  const target = document.querySelector("[data-graph-detail]");
  if (!target) return;
  if (!nodeData) {
    const stats = knowledgeGraphData.stats || {};
    target.innerHTML = `<span>图谱概览</span><strong>${Number(stats.node_count) || 0} 个公开节点</strong><p>单击节点查看摘要与真实关联，双击可进入知识库阅读全文。</p>`;
    return;
  }
  const relatedEdges = (knowledgeGraphData.edges || []).filter((edge) => edge.source === nodeData.id || edge.target === nodeData.id);
  const neighbors = relatedEdges.map((edge) => {
    const otherId = edge.source === nodeData.id ? edge.target : edge.source;
    const other = (knowledgeGraphData.nodes || []).find((node) => node.id === otherId);
    return other ? { ...other, relation: edge.label || edge.relation_type } : null;
  }).filter(Boolean);
  const completeNode = (appContent?.knowledgeNodes || []).find((node) => String(node.id) === String(nodeData.id));
  const articles = completeNode?.articles || [];
  const isColumn = nodeData.node_type === "column";
  const isGroup = nodeData.node_type === "group";
  target.innerHTML = `
    <div class="graph-detail-head"><span>${isColumn ? "知识专栏" : isGroup ? "主题分组" : "知识点"}</span><button type="button" data-graph-detail-close aria-label="关闭详情">×</button></div>
    <strong>${escapeHtml(nodeData.title)}</strong>
    <p>${escapeHtml(nodeData.summary || "暂无摘要")}</p>
    <dl>
      ${isColumn ? "" : `<div><dt>节点类型</dt><dd>${escapeHtml(nodeData.node_type || "concept")}</dd></div>`}
      <div><dt>直接关系</dt><dd>${relatedEdges.length}</dd></div>
      <div><dt>所属专栏</dt><dd>${escapeHtml(isColumn ? nodeData.title : (nodeData.columns || []).map((column) => column.name).join(" / ") || "未分类")}</dd></div>
    </dl>
    ${(nodeData.tags || []).length ? `<div class="graph-detail-tags">${nodeData.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    ${isGroup ? "" : `<a class="graph-detail-primary" href="${escapeHtml(nodeData.href)}">${isColumn ? "查看专栏" : "查看知识详情"}</a>`}
    <a class="graph-detail-secondary" href="admin/" target="_blank" rel="noreferrer">在后台建立跨专栏关联</a>
    ${neighbors.length ? `<div class="graph-neighbors"><span>直接关联</span>${neighbors.slice(0, 8).map((node) => `<a href="${escapeHtml(node.href)}"><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.relation)}</small></a>`).join("")}</div>` : ""}
    ${articles.length ? `<div class="graph-neighbors"><span>相关文章</span>${articles.slice(0, 5).map((article) => `<a href="#post-${escapeHtml(article.slug)}"><strong>${escapeHtml(article.title)}</strong><small>文章</small></a>`).join("")}</div>` : ""}
  `;
  target.querySelector("[data-graph-detail-close]")?.addEventListener("click", () => {
    knowledgeGraphInstance?.elements().removeClass("faded focused");
    knowledgeGraphInstance?.nodes().unselect();
    renderGraphDetail();
  });
}

function nodesForGraphColumn(content, columnSlug) {
  return (content.knowledgeGraph?.nodes || []).filter((node) =>
    (node.columns || []).some((column) => column.slug === columnSlug),
  );
}

function buildColumnKnowledgeGraph(content, columnSlug) {
  const column = (content.knowledgeColumns || []).find((item) => item.slug === columnSlug);
  const allNodes = content.knowledgeGraph?.nodes || [];
  const selectedNodes = nodesForGraphColumn(content, columnSlug);
  const selectedIds = new Set(selectedNodes.map((node) => String(node.id)));
  const touchingEdges = (content.knowledgeGraph?.edges || []).filter((edge) => selectedIds.has(String(edge.source)) || selectedIds.has(String(edge.target)));
  const externalIds = new Set(touchingEdges.flatMap((edge) => [String(edge.source), String(edge.target)]).filter((id) => !selectedIds.has(id)));
  const externalNodes = allNodes.filter((node) => externalIds.has(String(node.id)));
  const rootId = `column-${columnSlug}`;
  const rootColor = "#16a77b";
  const root = {
    id: rootId,
    title: column?.name || "知识专栏",
    summary: column?.description || "当前知识专栏的主题节点。",
    node_type: "column",
    importance: 6,
    tags: [],
    columns: column ? [{ name: column.name, slug: column.slug }] : [],
    href: `#column-${columnSlug}`,
    cluster_color: rootColor,
    is_root: true,
  };
  const groupsByKey = new Map();
  selectedNodes.forEach((node) => {
    const group = graphSemanticGroup(node);
    if (!groupsByKey.has(group.key)) groupsByKey.set(group.key, { ...group, nodes: [] });
    groupsByKey.get(group.key).nodes.push(node);
  });
  const groupNodes = [...groupsByKey.values()].map((group, index) => ({
    id: `group-${columnSlug}-${group.key}`,
    title: group.title,
    summary: `${column?.name || "当前专栏"}中的${group.title}知识簇。`,
    node_type: "group",
    importance: 4,
    tags: [],
    columns: column ? [{ name: column.name, slug: column.slug }] : [],
    href: `#column-${columnSlug}`,
    cluster_color: graphClusterPalette[index % graphClusterPalette.length],
    is_group: true,
    group_key: group.key,
  }));
  const groupEdges = groupNodes.map((group, index) => ({
    id: `group-link-${columnSlug}-${group.group_key}`,
    source: rootId,
    target: group.id,
    relation_type: "contains",
    label: "包含",
    description: "专栏包含该主题知识簇。",
    weight: 1,
    direction: "directed",
    is_membership: true,
    order: index,
  }));
  const selectedDecorated = selectedNodes.map((node) => {
    const group = graphSemanticGroup(node);
    const groupNode = groupNodes.find((item) => item.group_key === group.key);
    return { ...node, cluster_color: groupNode?.cluster_color || rootColor, group_id: groupNode?.id, is_external: false };
  });
  const membershipEdges = selectedDecorated.map((node, index) => ({
    id: `membership-${columnSlug}-${node.id}`,
    source: node.group_id,
    target: String(node.id),
    relation_type: "contains",
    label: "",
    description: "知识节点属于当前主题知识簇。",
    weight: 1,
    direction: "directed",
    is_membership: true,
    order: index,
  }));
  const externalColumns = [...new Map(externalNodes.flatMap((node) => node.columns || []).filter((item) => item.slug !== columnSlug).map((item) => [item.slug, item])).values()];
  const externalRoots = externalColumns.map((item) => ({
    id: `column-${item.slug}`,
    title: item.name,
    summary: `通过真实知识关系与 ${column?.name || "当前专栏"} 相连。`,
    node_type: "column",
    importance: 4,
    tags: [],
    columns: [item],
    href: `#column-${item.slug}`,
    cluster_color: graphColumnColor(item.slug),
    is_external: true,
    is_root: true,
  }));
  const externalDecorated = externalNodes.map((node) => {
    const externalColumn = (node.columns || []).find((item) => item.slug !== columnSlug) || node.columns?.[0];
    return { ...node, cluster_color: graphColumnColor(externalColumn?.slug), external_root_id: `column-${externalColumn?.slug}`, is_external: true };
  });
  const externalMembershipEdges = externalDecorated.map((node, index) => ({
    id: `external-membership-${columnSlug}-${node.id}`,
    source: node.external_root_id,
    target: String(node.id),
    relation_type: "contains",
    label: "",
    description: "跨专栏关联节点。",
    weight: 1,
    direction: "directed",
    is_membership: true,
    is_external: true,
    order: index,
  }));
  const explicitEdges = touchingEdges.map((edge) => ({ ...edge, is_cross_column: !selectedIds.has(String(edge.source)) || !selectedIds.has(String(edge.target)) }));
  const edges = [...groupEdges, ...membershipEdges, ...externalMembershipEdges, ...explicitEdges];
  return {
    column,
    nodes: [root, ...groupNodes, ...selectedDecorated, ...externalRoots, ...externalDecorated],
    edges,
    stats: { node_count: selectedNodes.length + externalNodes.length, edge_count: edges.length, explicit_edge_count: explicitEdges.length, cross_column_count: explicitEdges.filter((edge) => edge.is_cross_column).length },
  };
}

function clusteredGraphPositions(graph, width = 760, height = 620) {
  const positions = new Map();
  const center = { x: width / 2, y: height / 2 };
  const root = graph.nodes.find((node) => node.is_root && !node.is_external);
  if (root) positions.set(String(root.id), center);
  const groups = graph.nodes.filter((node) => node.is_group);
  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(groups.length, 1);
    const groupPosition = { x: center.x + Math.cos(angle) * 190, y: center.y + Math.sin(angle) * 170 };
    positions.set(String(group.id), groupPosition);
    const children = graph.nodes.filter((node) => node.group_id === group.id);
    children.forEach((node, childIndex) => {
      const childAngle = angle - 0.9 + (1.8 * childIndex) / Math.max(children.length - 1, 1);
      positions.set(String(node.id), { x: groupPosition.x + Math.cos(childAngle) * 90, y: groupPosition.y + Math.sin(childAngle) * 82 });
    });
  });
  const externalRoots = graph.nodes.filter((node) => node.is_root && node.is_external);
  externalRoots.forEach((externalRoot, index) => {
    const angle = Math.PI / 5 + (Math.PI * 1.6 * index) / Math.max(externalRoots.length, 1);
    const rootPosition = { x: center.x + Math.cos(angle) * 330, y: center.y + Math.sin(angle) * 265 };
    positions.set(String(externalRoot.id), rootPosition);
    const children = graph.nodes.filter((node) => node.external_root_id === externalRoot.id);
    children.forEach((node, childIndex) => {
      const childAngle = angle - 0.55 + (1.1 * childIndex) / Math.max(children.length - 1, 1);
      positions.set(String(node.id), { x: rootPosition.x + Math.cos(childAngle) * 76, y: rootPosition.y + Math.sin(childAngle) * 70 });
    });
  });
  return positions;
}

function renderGraphRecommendations(graph) {
  const target = document.querySelector("[data-graph-recommendations]");
  if (!target) return;
  const crossEdges = (graph.edges || []).filter((edge) => edge.is_cross_column);
  target.innerHTML = crossEdges.length ? crossEdges.slice(0, 4).map((edge) => {
    const source = graph.nodes.find((node) => String(node.id) === String(edge.source));
    const destination = graph.nodes.find((node) => String(node.id) === String(edge.target));
    if (!source || !destination) return "";
    return `<article><span>${escapeHtml(edge.label || "知识关联")}</span><strong>${escapeHtml(source.title)} ↔ ${escapeHtml(destination.title)}</strong><p>${escapeHtml(source.columns?.[0]?.name || "知识")} 与 ${escapeHtml(destination.columns?.[0]?.name || "知识")} 已建立真实连接</p><a href="admin/" target="_blank" rel="noreferrer">编辑关联</a></article>`;
  }).join("") : `<div class="graph-recommendation-empty"><strong>当前还没有跨专栏关系</strong><p>在后台为任意两个知识节点建立关系后，会自动在这里和图谱中出现。</p><a href="admin/" target="_blank" rel="noreferrer">建立第一条关联</a></div>`;
}

function populateGraphWorkspace(content, graph) {
  const nodeTypeSelect = document.querySelector("[data-graph-node-type]");
  const relationSelect = document.querySelector("[data-graph-relation-type]");
  const columnList = document.querySelector("[data-graph-column-list]");
  if (columnList) {
    columnList.innerHTML = (content.knowledgeColumns || []).map((column) => {
      const count = nodesForGraphColumn(content, column.slug).length;
      return `<button class="${column.slug === activeKnowledgeGraphColumn ? "is-active" : ""}" type="button" data-graph-column="${escapeHtml(column.slug)}"><span>${escapeHtml(column.name)}</span><strong>${count}</strong></button>`;
    }).join("");
    columnList.querySelectorAll("[data-graph-column]").forEach((button) => {
      button.addEventListener("click", () => {
        activeKnowledgeGraphColumn = button.dataset.graphColumn;
        activeKnowledgeGraphTags.clear();
        renderDatabaseKnowledgeGraph(content);
      });
    });
  }
  if (!nodeTypeSelect || !relationSelect) return;
  const nodeTypes = [...new Set((graph.nodes || []).map((node) => node.node_type).filter((type) => type && type !== "column"))].sort();
  nodeTypeSelect.innerHTML = `<option value="">全部类型</option>${nodeTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  const relationTypes = [...new Set((graph.edges || []).map((edge) => edge.relation_type).filter(Boolean))].sort();
  relationSelect.innerHTML = `<option value="">全部关系</option>${relationTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  const tags = [...new Set((graph.nodes || []).flatMap((node) => node.tags || []))].sort();
  const tagTarget = document.querySelector("[data-graph-tag-filter]");
  if (tagTarget) {
    tagTarget.innerHTML = tags.length ? tags.map((tag) => `<button class="${activeKnowledgeGraphTags.has(tag) ? "is-active" : ""}" type="button" data-graph-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("") : `<small>当前专栏暂无标签</small>`;
    tagTarget.querySelectorAll("[data-graph-tag]").forEach((button) => {
      button.addEventListener("click", () => {
        const tag = button.dataset.graphTag;
        if (activeKnowledgeGraphTags.has(tag)) activeKnowledgeGraphTags.delete(tag);
        else activeKnowledgeGraphTags.add(tag);
        button.classList.toggle("is-active", activeKnowledgeGraphTags.has(tag));
        applyKnowledgeGraphFilters();
      });
    });
  }
}

function applyKnowledgeGraphFilters() {
  if (!knowledgeGraphInstance) return;
  const query = [document.querySelector("[data-graph-search]")?.value, document.querySelector("[data-graph-filter-search]")?.value].find((value) => value?.trim())?.trim().toLowerCase() || "";
  const nodeType = document.querySelector("[data-graph-node-type]")?.value || "";
  const relationType = document.querySelector("[data-graph-relation-type]")?.value || "";
  const connectedOnly = document.querySelector("[data-graph-connected-only]")?.checked || false;
  const visibleIds = new Set();
  let firstVisibleNode = null;
  knowledgeGraphInstance.nodes().forEach((element) => {
    const data = element.data();
    const text = [data.title, data.summary, ...(data.tags || [])].join(" ").toLowerCase();
    const isRoot = data.node_type === "column" || data.node_type === "group";
    const matches = isRoot || ((!query || text.includes(query))
      && (!nodeType || data.node_type === nodeType)
      && (!activeKnowledgeGraphTags.size || [...activeKnowledgeGraphTags].every((tag) => (data.tags || []).includes(tag)))
      && (!connectedOnly || element.connectedEdges().filter((edge) => !edge.data("is_membership")).length > 0));
    element.style("display", matches ? "element" : "none");
    if (matches) {
      visibleIds.add(String(data.id));
      firstVisibleNode ||= element;
    }
  });
  let visibleEdges = 0;
  knowledgeGraphInstance.edges().forEach((element) => {
    const data = element.data();
    const matches = visibleIds.has(String(element.source().id()))
      && visibleIds.has(String(element.target().id()))
      && (!relationType || data.relation_type === relationType);
    element.style("display", matches ? "element" : "none");
    if (matches) visibleEdges += 1;
  });
  const stats = document.querySelector("[data-graph-stats]");
  const visibleKnowledgeCount = knowledgeGraphInstance.nodes(":visible").filter((node) => !["column", "group"].includes(node.data("node_type"))).length;
  if (stats) stats.innerHTML = `<span>知识节点 <strong>${visibleKnowledgeCount}</strong></span><span>真实关系 <strong>${visibleEdges}</strong></span>`;
  const summary = document.querySelector("[data-graph-summary]");
  if (summary) summary.textContent = `共 ${visibleKnowledgeCount} 个节点，${visibleEdges} 条关系，支持跨专栏连接`;
  knowledgeGraphInstance.elements().removeClass("faded focused");
  knowledgeGraphInstance.nodes().unselect();
  if (query && firstVisibleNode) {
    firstVisibleNode.select();
    firstVisibleNode.closedNeighborhood().addClass("focused");
    renderGraphDetail(firstVisibleNode.data());
  } else if (!query) {
    renderGraphDetail();
  }
  if (visibleIds.size) knowledgeGraphInstance.fit(knowledgeGraphInstance.elements(":visible"), 52);
}

function bindKnowledgeGraphControls() {
  const search = document.querySelector("[data-graph-search]");
  const filterSearch = document.querySelector("[data-graph-filter-search]");
  const nodeType = document.querySelector("[data-graph-node-type]");
  const relationType = document.querySelector("[data-graph-relation-type]");
  const connectedOnly = document.querySelector("[data-graph-connected-only]");
  [search, filterSearch, nodeType, relationType, connectedOnly].forEach((control) => {
    if (control) control.oninput = applyKnowledgeGraphFilters;
  });
  document.querySelectorAll("[data-graph-fit]").forEach((button) => { button.onclick = () => knowledgeGraphInstance?.fit(knowledgeGraphInstance.elements(":visible"), 60); });
  document.querySelectorAll("[data-graph-zoom-in]").forEach((button) => { button.onclick = () => {
    if (knowledgeGraphInstance) knowledgeGraphInstance.zoom({ level: Math.min(knowledgeGraphInstance.maxZoom(), knowledgeGraphInstance.zoom() * 1.25), renderedPosition: { x: knowledgeGraphInstance.width() / 2, y: knowledgeGraphInstance.height() / 2 } });
  }; });
  document.querySelectorAll("[data-graph-zoom-out]").forEach((button) => { button.onclick = () => {
    if (knowledgeGraphInstance) knowledgeGraphInstance.zoom({ level: Math.max(knowledgeGraphInstance.minZoom(), knowledgeGraphInstance.zoom() / 1.25), renderedPosition: { x: knowledgeGraphInstance.width() / 2, y: knowledgeGraphInstance.height() / 2 } });
  }; });
  document.querySelector("[data-graph-reset]").onclick = () => {
    [search, filterSearch].forEach((input) => { if (input) input.value = ""; });
    [nodeType, relationType].forEach((select) => { if (select) select.value = ""; });
    if (connectedOnly) connectedOnly.checked = false;
    activeKnowledgeGraphTags.clear();
    document.querySelectorAll("[data-graph-tag]").forEach((button) => button.classList.remove("is-active"));
    applyKnowledgeGraphFilters();
  };
  document.querySelectorAll("[data-graph-layout]").forEach((button) => {
    button.onclick = () => {
      activeKnowledgeGraphLayout = button.dataset.graphLayout;
      document.querySelectorAll("[data-graph-layout]").forEach((item) => item.classList.toggle("is-active", item === button));
      runKnowledgeGraphLayout();
    };
  });
  document.querySelector("[data-graph-fullscreen]").onclick = async () => {
    const studio = document.querySelector("[data-graph-studio]");
    if (!document.fullscreenElement) await studio?.requestFullscreen?.();
    else await document.exitFullscreen?.();
    window.setTimeout(() => { knowledgeGraphInstance?.resize(); knowledgeGraphInstance?.fit(undefined, 60); }, 120);
  };
  document.querySelector("[data-graph-export]").onclick = () => {
    const blob = new Blob([JSON.stringify(knowledgeGraphData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeKnowledgeGraphColumn || "knowledge"}-graph.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
}

function runKnowledgeGraphLayout() {
  if (!knowledgeGraphInstance) return;
  if (activeKnowledgeGraphLayout === "clustered") {
    const positions = clusteredGraphPositions(knowledgeGraphData, knowledgeGraphInstance.width(), knowledgeGraphInstance.height());
    knowledgeGraphInstance.layout({
      name: "preset",
      positions: (node) => positions.get(String(node.id())) || { x: knowledgeGraphInstance.width() / 2, y: knowledgeGraphInstance.height() / 2 },
      animate: true,
      animationDuration: 520,
      fit: true,
      padding: 64,
    }).run();
    return;
  }
  const options = activeKnowledgeGraphLayout === "cose"
    ? { name: "cose", animate: true, animationDuration: 520, fit: true, padding: 72, nodeRepulsion: 13000, idealEdgeLength: 125, gravity: 0.16, numIter: 1400, randomize: true }
    : { name: activeKnowledgeGraphLayout, animate: false, fit: true, padding: 72, startAngle: -Math.PI / 2, minNodeSpacing: 55 };
  knowledgeGraphInstance.layout(options).run();
}

let cytoscapeModulePromise = null;

async function ensureCytoscape() {
  if (typeof window.cytoscape === "function") return window.cytoscape;
  cytoscapeModulePromise ||= import("./vendor/cytoscape.esm.min.mjs").then((module) => {
    window.cytoscape = module.default;
    return module.default;
  });
  return cytoscapeModulePromise;
}

async function renderDatabaseKnowledgeGraph(content) {
  const target = document.querySelector("[data-knowledge-map]");
  const columns = content.knowledgeColumns || [];
  if (!activeKnowledgeGraphColumn || !columns.some((column) => column.slug === activeKnowledgeGraphColumn)) activeKnowledgeGraphColumn = columns[0]?.slug || "";
  const graph = buildColumnKnowledgeGraph(content, activeKnowledgeGraphColumn);
  knowledgeGraphData = graph;
  if (!target) return;
  populateGraphWorkspace(content, graph);
  renderGraphRecommendations(graph);
  const title = document.querySelector("[data-graph-title]");
  if (title) title.textContent = graph.column?.name || "知识网络";
  if (!graph.nodes?.length) {
    target.innerHTML = `<div class="empty-state"><strong>还没有公开图谱节点</strong><p>在后台创建节点和关系后会显示在这里。</p></div>`;
    renderGraphDetail();
    return;
  }
  try {
    await ensureCytoscape();
  } catch (error) {
    console.error("Unable to load knowledge graph engine", error);
    target.innerHTML = `<div class="graph-fallback">${graph.nodes.map((node) => `<a href="${escapeHtml(node.href)}">${escapeHtml(node.title)}</a>`).join("")}</div>`;
    renderGraphDetail();
    return;
  }
  if (knowledgeGraphInstance) knowledgeGraphInstance.destroy();
  target.innerHTML = "";
  knowledgeGraphInstance = window.cytoscape({
    container: target,
    elements: [
      ...graph.nodes.map((node) => ({ group: "nodes", data: { ...node, id: String(node.id) } })),
      ...graph.edges.map((edge) => ({ group: "edges", data: edge })),
    ],
    minZoom: 0.35,
    maxZoom: 2.5,
    wheelSensitivity: 0.22,
    style: [
      { selector: "node", style: { "background-color": "data(cluster_color)", "background-opacity": 0.12, "label": "data(title)", "color": "#17221d", "font-size": 10, "font-weight": 700, "text-wrap": "wrap", "text-max-width": 82, "text-valign": "center", "width": 46, "height": 46, "border-width": 1.5, "border-color": "data(cluster_color)", "shadow-blur": 18, "shadow-opacity": 0.18, "shadow-color": "data(cluster_color)", "transition-property": "width height border-width opacity", "transition-duration": "180ms" } },
      { selector: "node[node_type = 'column']", style: { "width": (element) => element.data("is_external") ? 62 : 88, "height": (element) => element.data("is_external") ? 62 : 88, "background-opacity": 0.9, "color": "#ffffff", "font-size": (element) => element.data("is_external") ? 11 : 14, "border-width": 5, "border-opacity": 0.18, "shadow-blur": 28, "shadow-opacity": 0.28 } },
      { selector: "node[node_type = 'group']", style: { "width": 64, "height": 64, "background-opacity": 0.78, "color": "#ffffff", "font-size": 11, "border-width": 8, "border-opacity": 0.12, "shadow-blur": 22, "shadow-opacity": 0.22 } },
      { selector: "node[is_external]", style: { "background-opacity": 0.18, "border-style": "dashed" } },
      { selector: "edge", style: { "width": (element) => element.data("is_cross_column") ? 2.8 : element.data("is_membership") ? 1.2 : Math.max(1.8, Math.min(4, Number(element.data("weight")) || 1)), "line-color": (element) => element.data("is_cross_column") ? "#e69542" : element.data("is_membership") ? "#b5c2bb" : "#55a887", "line-opacity": (element) => element.data("is_membership") ? 0.58 : 0.92, "line-style": (element) => element.data("is_membership") ? "dashed" : "solid", "target-arrow-color": (element) => element.data("is_cross_column") ? "#e69542" : element.data("is_membership") ? "#b5c2bb" : "#55a887", "target-arrow-shape": (element) => element.data("is_membership") ? "none" : "triangle", "arrow-scale": 0.65, "curve-style": "bezier", "label": (element) => element.data("is_cross_column") ? element.data("label") : "", "font-size": 8, "color": "#7c684d", "text-background-color": "#ffffff", "text-background-opacity": 0.94, "text-background-padding": 3 } },
      { selector: "node:selected", style: { "border-color": "#245fcc", "border-width": 4, "overlay-opacity": 0.05, "overlay-color": "#2f6fec" } },
      { selector: ".faded", style: { "opacity": 0.16, "text-opacity": 0.1 } },
      { selector: ".focused", style: { "opacity": 1, "z-index": 10 } },
    ],
    layout: { name: "preset" },
  });
  knowledgeGraphInstance.on("tap", "node", (event) => {
    const node = event.target;
    const now = Date.now();
    const isDoubleTap = lastGraphNodeTap.id === node.id() && now - lastGraphNodeTap.at < 360;
    lastGraphNodeTap = { id: node.id(), at: now };
    if (isDoubleTap && node.data("href")) {
      window.location.hash = node.data("href").replace(/^#/, "");
      return;
    }
    knowledgeGraphInstance.elements().addClass("faded");
    node.closedNeighborhood().removeClass("faded").addClass("focused");
    renderGraphDetail(node.data());
  });
  knowledgeGraphInstance.on("tap", (event) => {
    if (event.target !== knowledgeGraphInstance) return;
    knowledgeGraphInstance.elements().removeClass("faded focused");
    renderGraphDetail();
  });
  bindKnowledgeGraphControls();
  runKnowledgeGraphLayout();
  applyKnowledgeGraphFilters();
  renderGraphDetail();
}
