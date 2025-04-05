export interface IBookmark {
	id: number | string;
	title: string;
	description: string;
	url: string;
	imageUrl?: string;
	level1Id?: string;
	level2Id?: string;
	level3Id?: string[];
	createdAt?: Date | string;
	isFavorite?: boolean;
}