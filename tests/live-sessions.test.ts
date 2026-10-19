import "mocha/mocha.js";
import { getMochaConfig } from "@webwriter/build/test";
import { assert } from "chai";
import {
  aggregate,
  aggregateViews,
  authoredGraph,
  orderedNodes,
  participantState,
  readGraph,
  responseGraph,
  structuralGraph,
  type AggregateContext,
  type GraphState,
} from "../src/aggregate";
import "../src";
import { AutomatonComponent } from "../src";

mocha.setup(getMochaConfig());

const nodes = [
  {id: 0, label: "q0", initial: true, final: false, x: -180, y: 0},
  {id: 1, label: "q1", initial: false, final: true, x: 0, y: 0},
  {id: 2, label: "q2", initial: false, final: false, x: 180, y: 0},
];
const transitions = [
  {id: 0, from: 0, to: 1, label: "a", symbols: ["a"]},
  {id: 1, from: 0, to: 2, label: "b", symbols: ["b"]},
  {id: 2, from: 1, to: 2, label: "a", symbols: ["a"]},
  {id: 3, from: 1, to: 1, label: "b", symbols: ["b"]},
  {id: 4, from: 2, to: 2, label: "a,b", symbols: ["a", "b"]},
];
const graph: GraphState = {type: "dfa", nodes, transitions};
const referenceAttributes = {
  type: "dfa",
  nodes: "#0(-180|0);%1(0|0);2(180|0)",
  transitions: "0-1[a];0-2[b];1-2[a];1-1[b];2-2[a,b]",
  "reference-type": "dfa",
  "reference-nodes": "#0(-180|0);%1(0|0);2(180|0)",
  "reference-transitions": "0-1[a];0-2[b];1-2[a];1-1[b];2-2[a,b]",
};
const context: AggregateContext = {
  widget: {id: "webwriter-automaton", attributes: referenceAttributes, html: "<webwriter-automaton></webwriter-automaton>"},
  participants: [{id: "learner-a", name: "Ada"}, {id: "learner-b", name: "Lin"}],
  samples: [
    {id: "a", learners: ["learner-a"], value: {graph, explanation: "  State q1 accepts after the first a.  "}},
    {id: "b", learners: ["learner-b"], value: {graph: {...graph, nodes: graph.nodes.map(node => ({...node, x: node.x! + 30, y: node.y! + 20}))}, explanation: "The first a moves to the accepting state."}},
  ],
  missing: 0,
};

const declarationFor = (declarations: ReturnType<typeof aggregate>, shape: string) => {
  const declaration = declarations.find(candidate => candidate.shape === shape);
  assert.isDefined(declaration, `missing ${shape} aggregate declaration`);
  return declaration!;
};
const project = (declarations: ReturnType<typeof aggregate>, shape: string, value: unknown) => {
  const declaration = declarationFor(declarations, shape) as {value?: (data: unknown) => unknown};
  assert.isFunction(declaration.value, `${shape} should define a projector`);
  return declaration.value!(value);
};

describe("Automaton live-session aggregates", () => {
  it("publishes all seven projections without an aggregate-view attribute", () => {
    assert.deepEqual(aggregateViews, ["custom", "selection", "ordering", "number", "text", "spatial", "distancemap"]);
    assert.isFalse(Object.hasOwn(referenceAttributes, "aggregate-view"));
    const declarations = aggregate(context);
    assert.isArray(declarations);
    assert.deepEqual(declarations.map(declaration => declaration.shape), aggregateViews);
    assert.deepEqual(AutomatonComponent.aggregate(context).map(declaration => declaration.shape), aggregateViews);
  });

  it("projects accepting state IDs, left-to-right order, state count, explanation text, positions, structure, and a custom renderer", () => {
    const declarations = aggregate(context);
    const input = context.samples[0].value;

    assert.deepEqual(project(declarations, "selection", input), ["1"]);
    assert.deepEqual(project(declarations, "ordering", input), ["0", "1", "2"]);
    assert.equal(project(declarations, "number", input), 3);
    assert.equal(project(declarations, "text", input), "State q1 accepts after the first a.");
    assert.equal((project(declarations, "spatial", input) as unknown[]).length, 3);
    assert.deepEqual(project(declarations, "distancemap", input), structuralGraph(graph));
    assert.equal((declarationFor(declarations, "custom") as {element: string}).element, "webwriter-automaton-aggregate");
  });

  it("uses only explicit authored reference attributes", () => {
    const authored = authoredGraph(referenceAttributes, true);
    assert.isDefined(authored);
    assert.equal(authored!.type, "dfa");
    assert.deepEqual(authored!.nodes.filter(node => node.final).map(node => node.id), [1]);
    assert.equal(authoredGraph({type: "dfa", nodes: referenceAttributes.nodes, transitions: referenceAttributes.transitions}, true), undefined);
    for(const shape of ["selection", "ordering", "number", "spatial", "distancemap", "custom"]) {
      const declaration = declarationFor(aggregate(context), shape) as {reference?: unknown};
      assert.isDefined(declaration.reference, `${shape} should compare against an explicit reference`);
    }
  });

  it("normalizes spatial bounds around authored and participant coordinates", () => {
    const declaration = declarationFor(aggregate(context), "spatial") as {bounds: {width: number; height: number}; value: (data: unknown) => unknown};
    const bounds = declaration.bounds;
    assert.isAbove(bounds.width, 0);
    assert.isAbove(bounds.height, 0);
    for(const sample of context.samples) {
      const points = declaration.value(sample.value) as {x: number; y: number}[];
      assert.equal(points.length, 3);
      for(const point of points) {
        assert.isAtLeast(point.x, 0);
        assert.isAtMost(point.x, bounds.width);
        assert.isAtLeast(point.y, 0);
        assert.isAtMost(point.y, bounds.height);
      }
    }
  });

  it("validates participant snapshots and graph references", () => {
    assert.deepEqual(participantState("{}"), {});
    assert.equal(participantState('{"explanation":"ok"}').explanation, "ok");
    for(const invalid of ["[]", "{", '{"explanation":42}', '{"graph":{"type":"dfa","nodes":[],"transitions":[{"id":0,"from":0,"to":1,"symbols":["a"]}]}}']) {
      assert.throws(() => participantState(invalid));
    }
  });

  it("resolves missing learner graphs to the authored starter and rejects malformed submitted graphs", () => {
    const fallback = authoredGraph(referenceAttributes)!;
    assert.deepEqual(responseGraph({}, fallback), fallback);
    assert.equal(responseGraph({graph}, fallback).nodes.length, 3);
    assert.throws(() => readGraph({type: "dfa", nodes: [{...nodes[0]}, {...nodes[0]}], transitions: []}), /duplicate.*state/i);
  });

  it("ignores coordinates when comparing graph structure", () => {
    const moved: GraphState = {...graph, nodes: graph.nodes.map(node => ({...node, x: node.x! + 500, y: node.y! - 300}))};
    assert.deepEqual(structuralGraph(moved), structuralGraph(graph));
    assert.deepEqual(orderedNodes(graph).map(node => node.id), [0, 1, 2]);
  });
});

describe("Automaton live-session data integration", () => {
  const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
  const settle = async (widget: AutomatonComponent, milliseconds = 0) => {
    await widget.updateComplete;
    if(milliseconds) await sleep(milliseconds);
    await widget.updateComplete;
  };

  const connectWidget = async (options: {data?: Record<string, unknown>; answerRequests?: (request: number) => boolean} = {}) => {
    const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
    widget.setAttribute("lang", "en");
    widget.setAttribute("type", referenceAttributes.type);
    widget.setAttribute("nodes", referenceAttributes.nodes);
    widget.setAttribute("transitions", referenceAttributes.transitions);
    widget.setAttribute("reference-type", referenceAttributes["reference-type"]);
    widget.setAttribute("reference-nodes", referenceAttributes["reference-nodes"]);
    widget.setAttribute("reference-transitions", referenceAttributes["reference-transitions"]);
    const block = document.createElement("script");
    block.type = "application/json";
    block.slot = "data";
    block.textContent = JSON.stringify(options.data ?? {explanation: "Keep this explanation.", note: "keep this unknown field"});
    widget.append(block);
    let requests = 0;
    widget.addEventListener("datarequest", event => {
      event.preventDefault();
      requests++;
      if(options.answerRequests?.(requests) ?? true) {
        queueMicrotask(() => block.dispatchEvent(new Event("datachange", {bubbles: true})));
      }
    });
    document.body.append(widget);
    await settle(widget);
    await sleep(0);
    await settle(widget);
    assert.equal(requests, 1, "the widget should request its response data block");
    assert.isNotNull(widget.shadowRoot?.querySelector("textarea"), "the widget should have accepted ready data");
    return {widget, block, get requests() { return requests; }};
  };

  afterEach(() => {
    document.querySelectorAll("webwriter-automaton").forEach(widget => widget.remove());
  });

  it("writes graph edits to the JSON data block while preserving authored attributes and other response fields", async () => {
    const {widget, block} = await connectWidget();
    const authoredNodes = widget.getAttribute("nodes");
    const authoredTransitions = widget.getAttribute("transitions");
    widget.automaton.nodes.update({id: 1, x: 75, y: 25});
    await settle(widget, 250);

    const response = JSON.parse(block.textContent!);
    assert.equal(response.explanation, "Keep this explanation.");
    assert.equal(response.note, "keep this unknown field");
    assert.equal(response.graph.type, "dfa");
    assert.equal(response.graph.nodes.find((node: {id: number}) => node.id === 1).x, 75);
    assert.equal(widget.getAttribute("nodes"), authoredNodes);
    assert.equal(widget.getAttribute("transitions"), authoredTransitions);
  });

  it("preserves a queued graph edit when the explanation changes immediately", async () => {
    const {widget, block} = await connectWidget();
    widget.automaton.nodes.update({id: 1, x: 125, y: 25});
    const textarea = widget.shadowRoot!.querySelector("textarea")!;
    textarea.value = "A new explanation.";
    textarea.dispatchEvent(new Event("input", {bubbles: true}));
    await settle(widget, 250);
    const response = JSON.parse(block.textContent!);
    assert.equal(response.explanation, "A new explanation.");
    assert.equal(response.graph.nodes.find((node: {id: number}) => node.id === 1).x, 125);
  });

  it("applies a remote graph that removes states from the current graph", async () => {
    const {widget, block} = await connectWidget();
    const remote = {
      type: "dfa",
      nodes: [
        {id: 0, label: "q0", initial: true, final: false, x: -90, y: 0},
        {id: 1, label: "q1", initial: false, final: true, x: 90, y: 0},
      ],
      transitions: [{id: 0, from: 0, to: 1, label: "a", symbols: ["a"]}],
    };
    block.textContent = JSON.stringify({explanation: "Remote explanation.", graph: remote});
    block.dispatchEvent(new Event("datachange", {bubbles: true}));
    await settle(widget);

    assert.deepEqual(widget.automaton.nodes.get().filter(node => node.id >= 0).map(node => node.id), [0, 1]);
    assert.equal(widget.automaton.nodes.get().find(node => node.id === 1)?.final, true);
  });

  it("does not write graph edits while the data block is pending", async () => {
    const {widget, block} = await connectWidget();
    const original = block.textContent;
    block.dispatchEvent(new Event("datapending", {bubbles: true}));
    widget.automaton.nodes.update({id: 1, x: 100, y: 40});
    await settle(widget, 250);

    assert.equal(block.textContent, original);
  });

  it("cancels a debounced graph write when the data scope changes", async () => {
    const connected = await connectWidget({answerRequests: request => request === 1});
    const {widget, block} = connected;
    const original = block.textContent;
    widget.automaton.nodes.update({id: 1, x: 110, y: 55});
    widget.id = "new-data-scope";
    await settle(widget, 250);

    assert.equal(connected.requests, 2);
    assert.equal(block.textContent, original);
  });

  it("cancels a debounced graph write when the widget disconnects", async () => {
    const {widget, block} = await connectWidget();
    const original = block.textContent;
    widget.automaton.nodes.update({id: 1, x: 130, y: 60});
    widget.remove();
    await sleep(250);

    assert.equal(block.textContent, original);
  });
});

mocha.run();
