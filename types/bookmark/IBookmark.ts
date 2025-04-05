export interface IBookmark {
	id: number | string;
	title: string;
	description: string;
	url: string;
	imageUrl?: string;
	classificationIds: string[];
	createdAt?: Date | string;
}