import type { ISubCategory } from "~/types";

export interface ICategory {
	id: string;
	name: string;
	subCategories: ISubCategory[];
}