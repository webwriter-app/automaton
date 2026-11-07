export const ATTRIBUTE_CONVERTERS = {
	stringArray: {
		fromAttribute: (value: string | null): string[] => {
			if (value === null || value === "") return [];
			return value.split(" ").map((item) => item.trim());
		},
		toAttribute: (value: string[] | null): string | null => {
			if (value === null) return null;
			return value.join(" ");
		},
	},
};
