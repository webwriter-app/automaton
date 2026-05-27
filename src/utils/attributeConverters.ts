import { Node, Transition } from "automata";

const abbreviateStackOperation = (operation: string): string => {
	switch (operation) {
		case "pop":
			return "o";
		default:
			return operation.charAt(0).toLowerCase();
	}
};

const expandStackOperation = (
	abbreviated: string
): "push" | "pop" | "empty" | "none" => {
	switch (abbreviated) {
		case "p":
			return "push";
		case "o":
			return "pop";
		case "e":
			return "empty";
		default:
			return "none";
	}
};

const srAngleToDegrees = (angle: number): number => {
	return Math.round((450 - angle * (180 / Math.PI)) % 360);
};

const degreesToSrAngle = (degrees: number): number => {
	return ((450 - degrees) % 360) * (Math.PI / 180);
};

export const ATTRIBUTE_CONVERTERS = {
	stringArray: {
		fromAttribute: (value: string | null): string[] => {
			if (value === null) return [];
			return value.split(" ").map((item) => item.trim());
		},
		toAttribute: (value: string[] | null): string | null => {
			if (value === null) return null;
			return value.join(" ");
		},
	},

	nodeArray: {
		fromAttribute: (value: string | null): Node[] => {
			if (value === null) return [];

			return value
				.split(";")
				.map((nodeString) => {
					const node: Partial<Node> = {};
					let remaining = nodeString.trim();

					// Parse initial and final flags
					if (remaining.startsWith("#")) {
						node.initial = true;
						remaining = remaining.slice(1);
					}
					if (remaining.startsWith("%")) {
						node.final = true;
						remaining = remaining.slice(1);
					}

					// Parse ID
					const idMatch = remaining.match(/^(\d+)/);
					if (idMatch) {
						node.id = parseInt(idMatch[1], 10);
						remaining = remaining.slice(idMatch[1].length);
					} else {
						console.warn(
							"Invalid node string - no ID found:",
							nodeString
						);
						return;
					}

					// Parse label
					const labelMatch = remaining.match(
						/^\[([^\]]*(?:\\.[^\]]*)*)\]/
					);
					if (labelMatch) {
						// Unescape the label content
						const escapedLabel = labelMatch[1];
						node.label = decodeURIComponent(escapedLabel);
						remaining = remaining.slice(labelMatch[0].length);
					} else {
						node.label = "q" + node.id;
					}

					// Parse coordinates
					const coordMatch = remaining.match(/^\((-?\d+)\|(-?\d+)\)/);
					if (coordMatch) {
						node.x = parseInt(coordMatch[1], 10);
						node.y = parseInt(coordMatch[2], 10);
					}

					return node as Node;
				})
				.filter((node) => node !== undefined);
		},
		toAttribute: (value: Node[] | null): string | null => {
			if (value === null) return null;

			return value
				.map((node) => {
					if (typeof node === "object" && node !== null) {
						let nodeString: string = "";

						// Encode initial and final flags
						if (node.initial) nodeString += `#`;
						if (node.final) nodeString += `%`;

						// Encode ID
						nodeString += node.id.toString();

						// Encode label
						if (node.label && node.label !== "q" + node.id) {
							const escapedLabel = encodeURIComponent(node.label);
							nodeString += `[${escapedLabel}]`;
						}

						// Encode coordinates
						if (node.x !== undefined && node.y !== undefined) {
							nodeString += `(${Math.round(node.x)}|${Math.round(
								node.y
							)})`;
						}
						return nodeString;
					} else {
						console.warn("Invalid node object:", node);
						return "";
					}
				})
				.join(";");
		},
	},

	transitionArray: {
		fromAttribute: (value: string | null): Transition[] => {
			if (value === null) return [];

			return value
				.split(";")
				.map((transitionString, id) => {
					const transition: Partial<Transition> = {
						id: id,
					};
					let remaining = transitionString.trim();

					// Parse from->to states (required)
					const stateMatch = remaining.match(/^(\d+)-(\d+)/);
					if (stateMatch) {
						transition.from = parseInt(stateMatch[1], 10);
						transition.to = parseInt(stateMatch[2], 10);
						remaining = remaining.slice(stateMatch[0].length);
					} else {
						console.warn(
							"Invalid transition string - no from-to found:",
							transitionString
						);
						return;
					}

					// Parse symbols or stack operations
					const symbolsStackOpsMatches =
						remaining.match(/^([^~@]+?)(?=~|@|$)/);
					if (symbolsStackOpsMatches) {
						remaining = remaining.slice(
							symbolsStackOpsMatches[0].length
						);

						let operationsString = symbolsStackOpsMatches[1];
						if (
							operationsString.startsWith("[") &&
							operationsString.endsWith("]")
						) {
							operationsString = operationsString.slice(1, -1);
						} else {
							console.warn(
								"Invalid symbols/stack operations format:",
								operationsString
							);
							return;
						}

						// Check if it contains stack operations
						if (
							operationsString.includes("{") &&
							operationsString.includes("}")
						) {
							// Parse stack operations
							const stackOpsArray = [];
							const symbolsArray = [];
							const parts = operationsString.split(",");

							for (const part of parts) {
								const opMatch = part.match(
									/^(.*?)\{(.+?)\|(.*?)\|(.*?)\}$/
								);
								if (opMatch) {
									// Transition symbol (goes into symbols array)
									symbolsArray.push(
										decodeURIComponent(opMatch[1])
									);

									// Stack operation details
									stackOpsArray.push({
										operation: expandStackOperation(
											opMatch[2]
										),
										symbol: opMatch[3]
											? decodeURIComponent(opMatch[3])
											: "",
										condition: opMatch[4]
											? decodeURIComponent(opMatch[4])
											: "",
									});
								} else {
									console.warn(
										"Invalid stack operation format:",
										part
									);
								}
							}

							if (stackOpsArray.length > 0) {
								transition.symbols = symbolsArray;
								transition.stackOperations = stackOpsArray;
							}
						} else {
							transition.symbols = operationsString
								.split(",")
								.map(decodeURIComponent);
						}
					}

					// Parse roundness
					const roundnessMatch = remaining.match(
						/^~(-?)(\d+(?:\.\d+)?)/
					);
					if (roundnessMatch) {
						const isCounterClockwise = roundnessMatch[1] === "-";
						const roundnessValue = parseFloat(roundnessMatch[2]);

						transition.smooth = {
							enabled: true,
							type: isCounterClockwise ? "curvedCCW" : "curvedCW",
							roundness: roundnessValue,
						};

						remaining = remaining.slice(roundnessMatch[0].length);
					}

					// Parse self-reference angle
					const angleMatch = remaining.match(/^@(-?\d+)/);
					if (angleMatch) {
						const angle = degreesToSrAngle(
							parseInt(angleMatch[1], 10)
						);
						transition.selfReference = {
							angle: angle,
						};
					}

					return transition as Transition;
				})
				.filter((transition) => transition !== undefined);
		},
		toAttribute: (value: Transition[] | null): string | null => {
			if (value === null) return null;

			return value
				.map((transition) => {
					// Encode from and to states
					let transitionString = `${transition.from}-${transition.to}`;

					// Encode symbols (DFA, NFA) or symbols with stack operations (PDA)
					if (
						transition.stackOperations &&
						transition.stackOperations.length > 0
					) {
						for (
							let i = 0;
							i < transition.stackOperations.length;
							i++
						) {
							const symbol = encodeURIComponent(
								transition.symbols[i]
							);
							const op = transition.stackOperations[i];

							if (i > 0) {
								transitionString += ",";
							} else {
								transitionString += "[";
							}

							transitionString += `${symbol}{${abbreviateStackOperation(
								op.operation
							)}|${encodeURIComponent(
								op.symbol
							)}|${encodeURIComponent(op.condition)}}`;
						}
						transitionString += "]";
					} else if (
						transition.symbols &&
						transition.symbols.length > 0
					) {
						transitionString += `[${transition.symbols
							.map(encodeURIComponent)
							.join(",")}]`;
					}

					// Encode roundness
					if (
						transition.smooth &&
						typeof transition.smooth === "object" &&
						transition.smooth.roundness
					) {
						transitionString += `~${
							transition.smooth.type === "curvedCCW" ? "-" : ""
						}${transition.smooth.roundness}`;
					}

					// Encode self-reference angle
					if (
						transition.selfReference &&
						transition.selfReference.angle !== undefined
					) {
						transitionString += `@${srAngleToDegrees(
							transition.selfReference.angle
						)}`;
					}

					return transitionString;
				})
				.join(";");
		},
	},
};
