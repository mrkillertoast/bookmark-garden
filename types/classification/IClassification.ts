export interface IClassification {
	$id: string;
	name: string;
	level: 1 | 2 | 3;
	parentId: string | null;
	$createdAt: string;
	$updatedAt: string;
}