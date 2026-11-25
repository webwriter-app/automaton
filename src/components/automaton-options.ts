import { LitElementWw } from "@webwriter/lit";
import { ATTRIBUTE_CONVERTERS } from "../model/attribute-converters";
import type { Settings } from "./settings";

/**
 * The editor's options of the automaton widget that differ from their authored attributes. The widget supplies the properties they read.
 * @internal
 */
export abstract class AutomatonOptions extends LitElementWw {
	abstract readonly settings: Settings;
	abstract allowedTypes: string[];
	abstract allowedModes: string[];
	abstract allowedTransformations: string[];
	abstract showHelp: string;
	abstract showFormalDefinition: string;
	abstract showTransitionsTable: string;
	abstract testWords: string[];

	// The drawer's values differ from these settings' authored attribute formats.
	/** @internal */
	get selectedPermissions() { return this.settings.selectedPermissions; }
	set selectedPermissions(value: string[] | null) { this.settings.selectedPermissions = value; }

	/** @internal */
	get allowedTypeOptions() { return this.allowedTypes; }
	set allowedTypeOptions(value: string[] | null) {
		this.writeSetting("allowedtypes", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(value));
	}

	/** @internal */
	get sinkStateEnabled() { return this.allowedTransformations.includes("sink"); }
	set sinkStateEnabled(value: boolean | null) {
		const transformations = this.allowedTransformations.filter(transformation => transformation !== "sink");
		if (value === null && !transformations.length) {
			this.removeAttribute("allowedtransformations");
			return;
		}
		const enabled = value ?? true;
		if (this.sinkStateEnabled === enabled) return;
		if (enabled) transformations.push("sink");
		this.writeSetting("allowedtransformations", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(transformations));
	}

	/** @internal */
	get allowedModeOptions() { return this.allowedModes; }
	set allowedModeOptions(value: string[] | null) {
		this.writeSetting("allowedmodes", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(value));
	}

	/** @internal */
	get helpEnabled() { return this.showHelp === "true"; }
	set helpEnabled(value: boolean | null) { this.writeSetting("showhelp", value === null ? null : String(value)); }

	/** @internal */
	get formalDefinitionEnabled() { return this.showFormalDefinition === "true"; }
	set formalDefinitionEnabled(value: boolean | null) { this.writeSetting("showformaldefinition", value === null ? null : String(value)); }

	/** @internal */
	get transitionsTableEnabled() { return this.showTransitionsTable === "true"; }
	set transitionsTableEnabled(value: boolean | null) { this.writeSetting("showtransitionstable", value === null ? null : String(value)); }

	/** @internal */
	get testWordsInput() { return (this.testWords ?? []).join(","); }
	set testWordsInput(value: string | null) {
		this.writeSetting("testwords", value === null ? null : JSON.stringify(value ? value.split(",") : []));
	}

	protected writeSetting(attribute: string, value: string | null) {
		if (value === null) this.removeAttribute(attribute);
		else this.setAttribute(attribute, value);
	}
}
