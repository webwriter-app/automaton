import type { ReactiveController, ReactiveControllerHost } from "lit";
import { participantState, type ParticipantState } from "./aggregate";

type Host = ReactiveControllerHost & HTMLElement;
/** Native data-block contract for the widget's existing LitElementWw 2.x base. */
export class ParticipantData implements ReactiveController {
	ready = false;
	error = "";
	value: ParticipantState = {};
	private block?: HTMLScriptElement;
	private scope = "";
	private managed = false;
	private observer?: MutationObserver;
	private connected = false;

	constructor(private host: Host, private changed: () => void) { host.addController(this); }

	hostConnected() {
		this.connected = true;
		for(const name of ["datachange", "datapending", "dataerror"]) this.host.addEventListener(name, this.event);
		this.observer = new MutationObserver(() => this.sync());
		this.observer.observe(this.host, {childList: true, characterData: true, subtree: true, attributes: true});
		queueMicrotask(() => { if(this.connected) this.sync(); });
	}

	hostDisconnected() {
		this.connected = false;
		for(const name of ["datachange", "datapending", "dataerror"]) this.host.removeEventListener(name, this.event);
		this.observer?.disconnect();
		this.observer = undefined;
		this.block = undefined;
		this.ready = false;
	}

	private signature() {
		return JSON.stringify([this.host.ownerDocument.documentElement.id, this.host.id, this.host.getAttribute("shared"),
			...Array.from(this.host.childNodes).filter(node => node.nodeType === 7 && node.nodeName === "ww-grouping").map(node => node.nodeValue)]);
	}

	private sync() {
		if(!this.connected) return;
		let block = this.host.querySelector<HTMLScriptElement>(':scope > script[slot="data"]');
		if(!block) {
			block = this.host.ownerDocument.createElement("script");
			block.type = "application/json";
			block.slot = "data";
			block.textContent = "{}";
			this.host.append(block);
		}
		if(block.type !== "application/json" || block.hasAttribute("src")) {
			this.ready = false; this.error = "Automaton responses require a JSON data block without src."; this.host.requestUpdate(); return;
		}
		const scope = this.signature();
		if(block !== this.block || scope !== this.scope) {
			this.block = block; this.scope = scope; this.ready = false; this.error = ""; this.managed = false;
			this.changed();
			const request = new (this.host.ownerDocument.defaultView!.Event)("datarequest", {bubbles: true, cancelable: true});
			this.managed = !block.dispatchEvent(request);
			if(!this.managed) this.accept();
			else this.host.requestUpdate();
		}
		else if(!this.managed) this.accept();
	}

	private accept() {
		try {
			const value = participantState(this.block?.textContent ?? "{}");
			const changed = JSON.stringify(value) !== JSON.stringify(this.value) || !this.ready;
			this.value = value; this.ready = true; this.error = "";
			if(changed) this.changed();
		}
		catch(error) { this.ready = false; this.error = error instanceof Error ? error.message : String(error); }
		this.host.requestUpdate();
	}

	private event = (event: Event) => {
		const block = this.host.querySelector<HTMLScriptElement>(':scope > script[slot="data"]');
		if(event.target !== block || !block || block.type !== "application/json" || block.hasAttribute("src")) return;
		this.block = block;
		this.managed = true;
		if(event.type === "datachange") this.accept();
		else {
			this.ready = false;
			this.error = event.type === "dataerror" ? (event as CustomEvent).detail?.message ?? "Widget data is unavailable." : "";
			this.changed();
			this.host.requestUpdate();
		}
	};

	write(patch: Partial<ParticipantState>) {
		const current = this.host.querySelector(':scope > script[slot="data"]');
		if(!this.ready || !this.connected || !this.block?.isConnected || current !== this.block || this.signature() !== this.scope || this.block.type !== "application/json" || this.block.hasAttribute("src")) return false;
		try {
			const value = {...participantState(this.block.textContent ?? "{}"), ...patch};
			participantState(JSON.stringify(value));
			const text = JSON.stringify(value).replace(/</g, "\\u003c");
			if(this.block.textContent !== text) this.block.textContent = text;
			if(!this.managed) this.accept();
			return true;
		}
		catch(error) { this.error = error instanceof Error ? error.message : String(error); this.host.requestUpdate(); return false; }
	}
}
