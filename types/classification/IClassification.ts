export interface IClassification {
	$id: string;
	name: string;
	level: 1 | 2 | 3;
	parentIds?: string[]; // Changed from parentId: string | null to parentIds: string[]
	$createdAt: string;
	$updatedAt: string;
}