import { nanoid } from "nanoid";

export const generateUniqueRruleId = (): string => {
	return `${Date.now()}-${nanoid(5)}`;
};
