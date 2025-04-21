export interface IBookmark {
	id: number | string;
	title: string;
	description: string;
	url: string;
	imageUrl?: string;
	level1Id?: string;
	level2Ids?: string[]; // Changed from level2Id to level2Ids (array)
	level3Ids?: string[]; // Renamed for consistency
	createdAt?: Date | string;
	isFavorite?: boolean;
}