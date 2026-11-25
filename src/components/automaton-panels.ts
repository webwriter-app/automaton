import { html, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { MsgFn } from "@lit/localize";
import type { Graph } from "./graph";
import { renderPrintDiagram } from "./diagram-print";
import type { Node } from "../model/automaton-data";
import type { Layout } from "../model/diagram";
import { biBoxes, biExclamationTriangle, biPencil } from "./icons";
import type { AutomatonType } from "../widgets/webwriter-automaton";

type Mode = "edit" | "simulate";

interface HelpArgs {
	msg: MsgFn;
	mode: Mode;
	offersSink: boolean;
	canAddNode: boolean;
}

interface PrintArgs {
	msg: MsgFn;
	type: AutomatonType;
	invalid: boolean;
	startingStack: readonly string[];
	nodes: readonly Node[];
	layout: Layout | undefined;
}

interface ModeArgs {
	msg: MsgFn;
	mode: Mode;
	canEdit: boolean;
	canSimulate: boolean;
	showWarningIndicator: boolean;
	setMode: (mode: Mode) => void;
}

interface WarningArgs {
	msg: MsgFn;
	invalid: boolean;
	showHelp: boolean;
	graph: Graph | undefined;
}

export function renderPrintMachine({ msg, type, invalid, startingStack, nodes, layout }: PrintArgs) {
	const label = type === "dfa" ? msg("DFA") : type === "nfa" ? msg("NFA") : msg("PDA");
	return html`
		<figure class="print-machine">
			<figcaption>
				<strong>${label}</strong>
				${type === "pda" && !invalid ? html`
					<span>${msg("Starting stack")} <code>[${startingStack.join(", ")}]</code></span>
				` : ""}
			</figcaption>
			${invalid
				? html`<p>${msg("The automaton data block is invalid or uses an unsupported format.")}</p>`
				: nodes.length && layout
					? renderPrintDiagram(nodes, layout, msg("State diagram"))
					: html`<p>${msg("No states yet")}</p>`}
		</figure>
	`;
}

export function renderHelpOverlay({ msg, mode, offersSink, canAddNode }: HelpArgs): TemplateResult {
	return html`
		<div class="help-backdrop"></div>
		<div class="help-overlay">
			<sl-tag size="small" style="top:50px;left:10px"
				>${msg("Mode Switch")}</sl-tag
			>

			<sl-tag size="small" class="help-overlay__fullscreen"
				>${msg("Fullscreen")}</sl-tag
			>
			<div
				class="line"
				style="top: 55px;right: 30px;height: 164px;"
			></div>

			<sl-tag size="small" style="top:18px;right:275px"
				>${msg("Type")}</sl-tag
			>
			<div class="line" style="top:28px;right:260px;width:10px"></div>

			<sl-tag size="small" style="top: 186px;right: 275px;"
				>${msg("Help")}</sl-tag
			>
			<div
				class="line"
				style="top: 55px;right: 80px;width: 190px;height: 141px;"
			></div>

			<sl-tag size="small" style="top: 144px;right: 275px;"
				>${msg("Test Cases")}</sl-tag
			>
			<div
				class="line"
				style="top: 55px;right: 130px;width: 140px;height: 99px;"
			></div>

			<sl-tag size="small" style="top: 102px;right: 275px;"
				>${msg("Definition")}</sl-tag
			>
			<div
				class="line"
				style="top: 55px;right: 180px;width: 90px;height: 57px;"
			></div>
		</div>

		<div
			class="help-overlay edit-help"
			style=${styleMap({
				display: mode === "edit" ? "block" : "none",
			})}
		>
			${offersSink ? html`
				<sl-tag size="small" class="edit-help__sink">${msg("Add sink state")}</sl-tag>
			` : ""}
			${canAddNode ? html`<sl-tag size="small" style="bottom: 26px;left: 70px;"
				>${msg("Click or drag + to add a node")}</sl-tag
			>` : ""}
			<sl-tag size="small" class="edit-help__transition"
				>${msg("Add Transition by drag and drop")}</sl-tag
			>

			<sl-tag size="small" style="bottom: 110px;right: 30px;"
				>${msg("Move the elements by drag and drop")}</sl-tag
			>
			<sl-tag size="small" style="bottom: 70px;right: 30px;"
				>${msg("Select a node or transition to edit it")}</sl-tag
			>
		</div>

		${mode === "simulate" ? html`
			<div class="help-overlay simulator-help">
				<sl-tag size="small">${msg("Input word")}</sl-tag>
				<sl-tag size="small">${msg("Simulation Controls")}</sl-tag>
			</div>
		` : ""}
	`;
}

export function renderCompactHelp({ msg, mode, isPda, offersSink, canAddNode, canDeleteStackItems }: HelpArgs & { isPda: boolean; canDeleteStackItems: boolean }): TemplateResult {
	return html`
		<div class="help-backdrop"></div>
		<div class="compact-help" role="region" aria-label=${msg("Help")} tabindex="0">
			<span>${msg("Mode Switch")}</span>
			<span>${msg("Menu")}</span>
			${isPda ? html`
				<span>${mode === "edit" && canDeleteStackItems
					? msg("Remove stack items with ×") : msg("Stack")}</span>
			` : ""}
			${mode === "edit" ? html`
				${offersSink ? html`<span>${msg("Add sink state")}</span>` : ""}
				${canAddNode ? html`<span>${msg("Click or drag + to add a node")}</span>` : ""}
				<span>${msg("Add Transition by drag and drop")}</span>
				<span>${msg("Select a node or transition to edit it")}</span>
			` : html`
				<span>${msg("Input word")}</span>
				<span>${msg("Simulation Controls")}</span>
			`}
		</div>
	`;
}

export function renderModeSwitch({ msg, mode, canEdit, canSimulate, showWarningIndicator, setMode }: ModeArgs): TemplateResult {
	return html`<div class="mode_switch">
		<sl-tooltip
			content=${msg("Switch mode (Ctrl+M)")}
			placement="bottom-start"
		>
			<div class="mode_switch__buttons" role="group" aria-label=${msg("Mode Switch")} contenteditable="false">
				<button
					type="button"
					aria-pressed=${mode === "edit"}
					?disabled=${!canEdit}
					@click=${() => { setMode("edit"); }}
				>
					<span aria-hidden="true">${biPencil}</span>
					<span class="mode_switch__label">${msg("Edit")}</span>
				</button>
				<button
					type="button"
					aria-pressed=${mode === "simulate"}
					?disabled=${!canSimulate}
					@click=${() => { setMode("simulate"); }}
				>
					<span aria-hidden="true">${biBoxes}</span>
					<span class="mode_switch__label">${msg("Simulate")}</span>
				</button>
			</div>
		</sl-tooltip>
		${showWarningIndicator ? html`
			<button type="button" class="mode_switch__error_indicator" aria-label=${msg("Warnings")}
				aria-describedby="automaton-warnings" contenteditable="false">
				<span aria-hidden="true">${biExclamationTriangle}</span>
			</button>
		` : ""}
	</div>`;
}

export function renderWarnings({ msg, invalid, showHelp, graph }: WarningArgs) {
	if (invalid) return html`
		<sl-alert class="warning-panel" variant="warning" open>
			${msg("The automaton data block is invalid or uses an unsupported format.")}
		</sl-alert>
	`;
	if (!showHelp || !graph?.errors.length) return;
	const { errors, nodeWarnings } = graph;
	return html`
		<sl-alert id="automaton-warnings" class="warning-panel warning-panel--all" variant="warning" open>
			<ul>
				${errors.map(error => html`
					<li>${error.node ? html`<b>${error.node.label}:</b> ` : ""}${error.message(msg)}</li>
				`)}
			</ul>
		</sl-alert>
		${nodeWarnings.length ? html`
			<sl-alert class="warning-panel warning-panel--node" variant="warning" open>
				<ul>${nodeWarnings.map(error => html`<li>${error.message(msg)}</li>`)}</ul>
			</sl-alert>
		` : ""}
	`;
}

