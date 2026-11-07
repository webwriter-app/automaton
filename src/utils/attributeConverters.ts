export const ATTRIBUTE_CONVERTERS = {
	stringArray: {
		fromAttribute: (value: string | null): string[] | null => {
			if (value === null) return null;
			if (value === "") return [];
			return value.split(" ").map((item) => item.trim());
		},
		toAttribute: (value: string[] | null): string | null => {
			if (value === null) return null;
			return value.join(" ");
		},
	},
};
