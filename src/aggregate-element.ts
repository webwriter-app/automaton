import {LitElement, css, html, svg, type TemplateResult} from "lit"
import {authoredGraph, readGraph, responseGraph, transitionKey, type AggregateContext, type GraphState} from "./aggregate"

type GraphNode = GraphState["nodes"][number]
type GraphTransition = GraphState["transitions"][number]
type Point = {x: number; y: number}
type NodeCount = {node: GraphNode; count: number; accepting: number}
type EdgeCount = {edge: GraphTransition; count: number; key: string}
type PositionedNode = NodeCount & Point
type PositionedEdge = EdgeCount & {path: string; labelPoint: Point; color: string; dash?: string; width: number; marker: string}
type SvgGeometry = {width: number; height: number; map: (point: Point) => Point}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** A read-only aggregate view of automaton responses. Register in the widget's scoped registry. */
export class AutomatonAggregateElement extends LitElement {
	static properties = {
		aggregate: {attribute: false},
		reference: {attribute: false},
		selection: {attribute: false},
	}

	static styles = css`
		:host { display:block; min-width:0; color:#25364a; font:12px/1.35 system-ui,sans-serif; }
		.summary { margin:0 0 8px; color:#64748b; font-size:11px; }
		svg { display:block; width:100%; height:auto; max-height:min(280px, 58vh); background:#f8fafc; border-radius:5px; }
		.edge-label { paint-order:stroke; stroke:#f8fafc; stroke-width:4px; stroke-linejoin:round; font-size:11px; text-anchor:middle; fill:#334155; }
		.edge-count { paint-order:stroke; stroke:#f8fafc; stroke-width:4px; stroke-linejoin:round; font-size:10px; text-anchor:middle; fill:#64748b; }
		.node { fill:#fff; stroke:#334155; stroke-width:2; }
		.node.reference { stroke:#15945f; }
		.node.non-reference { stroke:#c93636; stroke-dasharray:5 3; }
		.node.selected { stroke:#2879d9; stroke-width:4; }
		.node.final { fill:#ecfdf5; }
		.node-label { fill:#172033; font-size:12px; font-weight:600; text-anchor:middle; }
		.node-count { fill:#64748b; font-size:10px; text-anchor:middle; }
		.initial { fill:none; stroke:#334155; stroke-width:2; }
		.empty { margin:0; color:#64748b; }
	`

	declare aggregate?: AggregateContext
	declare reference?: GraphState
	declare selection: readonly string[]

	constructor() { super(); this.selection = []; }

	protected render(): TemplateResult {
		if(!this.aggregate) return html``
		try { return this.renderAggregate(this.aggregate) }
		catch(error) {
			const message = error instanceof Error ? error.message : "Automaton aggregate unavailable"
			return html`<p class="empty" role="status">${message}</p>`
		}
	}

	private renderAggregate(context: AggregateContext): TemplateResult {
		const fallback = authoredGraph(context.widget.attributes)!
		const graphs = context.samples.map(sample => responseGraph(sample.value, fallback))
		const explicitReference = this.reference ?? (context.reference ? readGraph(context.reference) : undefined)
		const reference = explicitReference ? readGraph(explicitReference) : undefined
		const nodeCounts = new Map<number, NodeCount>()
		const edgeRepresentatives = new Map<string, GraphTransition>()
		const edgeCounts = new Map<string, number>()

		for(const graph of graphs) {
			for(const node of graph.nodes) {
				const current = nodeCounts.get(node.id) ?? {node, count: 0, accepting: 0}
				current.count++
				if(node.final) current.accepting++
				nodeCounts.set(node.id, current)
			}
			const seen = new Set<string>()
			for(const edge of graph.transitions) {
				const key = transitionKey(edge)
				if(seen.has(key)) continue
				seen.add(key)
				if(!edgeRepresentatives.has(key)) edgeRepresentatives.set(key, edge)
				edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
			}
		}
		// Include reference-only transitions so the expected graph remains visible with a zero count.
		for(const graph of [reference]) {
			for(const edge of graph?.transitions ?? []) {
				const key = transitionKey(edge)
				if(!edgeRepresentatives.has(key)) edgeRepresentatives.set(key, edge)
			}
		}

		// Prefer positions from the explicit reference, then authored defaults, then the first response.
		const positions = new Map<number, Point>()
		for(const graph of [reference, fallback, graphs[0]]) {
			for(const node of graph?.nodes ?? []) {
				if(!positions.has(node.id) && finite(node.x) && finite(node.y)) positions.set(node.id, {x: node.x, y: node.y})
			}
		}
		// Use first-response labels where possible; reference-only states remain visible.
		const displayNodes = new Map<number, GraphNode>()
		for(const graph of [...graphs, reference]) {
			for(const node of graph?.nodes ?? []) if(!displayNodes.has(node.id)) displayNodes.set(node.id, node)
		}
		const ids = [...displayNodes.keys()].sort((a, b) => a - b)
		const positionedNodes = this.positionNodes(ids, displayNodes, nodeCounts, positions)
		const geometry = this.geometry(positionedNodes)
		const svgNodes = positionedNodes.map(node => ({...node, ...geometry.map(node)}))
		const refNodes = new Set(reference?.nodes.map(node => node.id) ?? [])
		const refEdges = new Set(reference?.transitions.map(transitionKey) ?? [])
		const hasReference = reference !== undefined
		const positionedEdges = this.positionEdges([...edgeRepresentatives].map(([key, edge]) => ({edge, key, count: edgeCounts.get(key) ?? 0})), svgNodes, refEdges, hasReference, graphs.length)
		const legend = `Lines show response frequency; node labels show presence and accepting fraction${hasReference ? ". Green marks the reference; dashed red marks differences." : "."}`

		if(!positionedNodes.length) return html`
			<p class="summary">${legend}</p>
			<p class="empty">No automaton states to show.</p>
		`

		return html`
			<p class="summary">${legend}</p>
			${this.graphSvg(svgNodes, positionedEdges, geometry, context.samples.length, refNodes, hasReference)}
		`
	}

	private positionNodes(ids: number[], displayNodes: Map<number, GraphNode>, counts: Map<number, NodeCount>, preferred: Map<number, Point>): PositionedNode[] {
		const fallbackRadius = Math.max(95, ids.length * 19)
		return ids.map((id, index) => {
			const angle = -Math.PI / 2 + 2 * Math.PI * index / Math.max(1, ids.length)
			const point = preferred.get(id) ?? {x: Math.cos(angle) * fallbackRadius, y: Math.sin(angle) * fallbackRadius}
			return {...(counts.get(id) ?? {node: displayNodes.get(id)!, count: 0, accepting: 0}), ...point}
		})
	}

	private geometry(nodes: PositionedNode[]) {
		const xs = nodes.map(node => node.x), ys = nodes.map(node => node.y)
		const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
		const rawWidth = Math.max(1, maxX - minX + 120), rawHeight = Math.max(1, maxY - minY + 120)
		const width = 720
		const height = Math.max(180, Math.min(280, Math.round(width * rawHeight / rawWidth)))
		const availableWidth = width - 110, availableHeight = height - 100
		const scale = Math.min(availableWidth / Math.max(1, maxX - minX), availableHeight / Math.max(1, maxY - minY))
		const usedWidth = (maxX - minX) * scale, usedHeight = (maxY - minY) * scale
		return {
			width, height,
			map: (point: Point): Point => ({
				x: 55 + (availableWidth - usedWidth) / 2 + (point.x - minX) * scale,
				y: 50 + (availableHeight - usedHeight) / 2 + (point.y - minY) * scale,
			}),
		}
	}

	private positionEdges(edges: EdgeCount[], nodes: PositionedNode[], refEdges: Set<string>, hasReference: boolean, sampleCount: number): PositionedEdge[] {
		const points = new Map(nodes.map(node => [node.node.id, node] as const))
		const parallel = new Map<string, EdgeCount[]>()
		for(const item of edges) {
			const key = `${item.edge.from}:${item.edge.to}`
			const group = parallel.get(key) ?? []
			group.push(item)
			parallel.set(key, group)
		}
		const cursor = new Map<string, number>()
		return edges.map((item, index) => {
			const from = points.get(item.edge.from)!, to = points.get(item.edge.to)!
			const groupKey = `${item.edge.from}:${item.edge.to}`
			const group = parallel.get(groupKey)!
			const offset = (cursor.get(groupKey) ?? 0) - (group.length - 1) / 2
			cursor.set(groupKey, (cursor.get(groupKey) ?? 0) + 1)
			const dx = to.x - from.x, dy = to.y - from.y;
			const skipsNode = nodes.some(node => {
				if(node === from || node === to) return false;
				const t = ((node.x - from.x) * dx + (node.y - from.y) * dy) / (dx * dx + dy * dy || 1);
				return t > 0 && t < 1 && Math.hypot(node.x - from.x - t * dx, node.y - from.y - t * dy) < 30;
			});
			const path = this.transitionPath(from, to, offset + (skipsNode ? 4 : parallel.has(`${item.edge.to}:${item.edge.from}`) && from !== to ? 2 : 0))
			const isReference = refEdges.has(item.key)
			const color = isReference ? "#15945f" : hasReference ? "#c93636" : "#475569"
			const isNonReference = hasReference && !isReference
			return {
				...item, path: path.d, labelPoint: path.label, color,
				...(isNonReference ? {dash: "6 4"} : {}),
				width: 1.5 + 4 * item.count / Math.max(1, sampleCount), marker: `auto-arrow-${index}`,
			}
		})
	}

	private transitionPath(from: Point, to: Point, offset: number) {
		if(from.x === to.x && from.y === to.y) {
			const d = `M ${from.x - 13} ${from.y - 24} C ${from.x - 52 - offset * 8} ${from.y - 82 - offset * 8}, ${from.x + 52 + offset * 8} ${from.y - 82 - offset * 8}, ${from.x + 13} ${from.y - 24}`
			return {d, label: {x: from.x, y: from.y - 72 - offset * 8}}
		}
		const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1
		const start = {x: from.x + dx / length * 27, y: from.y + dy / length * 27}
		const end = {x: to.x - dx / length * 29, y: to.y - dy / length * 29}
		const control = {x: (start.x + end.x) / 2 - dy / length * offset * 30, y: (start.y + end.y) / 2 + dx / length * offset * 30}
		const label = {x: (start.x + 2 * control.x + end.x) / 4, y: (start.y + 2 * control.y + end.y) / 4}
		return {d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, label}
	}

	private edgeLabel(edge: GraphTransition) {
		const labels = edge.symbols.map((symbol, index) => {
			const operation = edge.stackOperations?.[index]
			return operation ? `${symbol || "ε"} / ${operation.operation}${operation.symbol ? ` ${operation.symbol}` : ""}${operation.condition ? `, ${operation.condition}` : ""}` : symbol || "ε"
		})
		return labels.join(", ") || "ε"
	}

	private graphSvg(nodes: PositionedNode[], edges: PositionedEdge[], geometry: SvgGeometry, sampleCount: number, referenceNodes: Set<number>, hasReference: boolean) {
		return svg`
			<svg viewBox=${`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label="Union of automaton responses">
				<defs>
					${edges.map(edge => svg`<marker id=${edge.marker} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill=${edge.color}></path></marker>`)}
				</defs>
				${edges.map(edge => {
					const label = this.edgeLabel(edge.edge), midpoint = edge.labelPoint
					const count = {x: edge.labelPoint.x, y: edge.labelPoint.y + 15}
					return svg`<g>
						<path d=${edge.path} fill="none" stroke=${edge.color} stroke-width=${edge.width} stroke-dasharray=${edge.dash ?? ""} marker-end=${`url(#${edge.marker})`}></path>
						<text class="edge-label" x=${midpoint.x} y=${midpoint.y}>${label}</text>
						<text class="edge-count" x=${count.x} y=${count.y}>${edge.count}/${sampleCount}</text>
					</g>`
				})}
				${nodes.map(entry => {
					const point = entry, id = entry.node.id, reference = referenceNodes.has(id)
					const nonReference = hasReference && !reference
					const classes = ["node", entry.node.final ? "final" : "", reference ? "reference" : "", nonReference ? "non-reference" : "", this.selection.includes(String(id)) ? "selected" : ""].filter(Boolean).join(" ")
					const title = `${entry.node.label} · state ${id} · present ${entry.count}/${sampleCount} · accepting ${entry.accepting}/${entry.count}`
					return svg`<g data-node-id=${String(id)}>
						<title>${title}</title>
						${entry.node.initial ? svg`<path class="initial" d=${`M ${point.x - 43} ${point.y} L ${point.x - 29} ${point.y}`} marker-end="url(#auto-initial-arrow)"></path>` : ""}
						<circle class=${classes} cx=${point.x} cy=${point.y} r="25"></circle>
						${entry.accepting > 0 ? svg`<circle class=${classes} cx=${point.x} cy=${point.y} r="20" fill="none"></circle>` : ""}
						<text class="node-label" x=${point.x} y=${point.y + 4}>${entry.node.label}</text>
						<text class="node-count" x=${point.x} y=${point.y + 42}>${entry.count}/${sampleCount} · accepts ${entry.accepting}/${entry.count}</text>
					</g>`
				})}
				<defs><marker id="auto-initial-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"></path></marker></defs>
			</svg>
		`
	}
}
