import type { ITag } from "~/types";

export interface ISubCategory {
	id: string;
	name: string;
	level3Tags?: ITag[]
}