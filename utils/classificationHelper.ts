import type { IClassification } from '~/types';

export function getClassificationNameById(classifications: Ref<IClassification[] | null>, id: string | null): string | null {
	if (!id || !classifications.value) return null;
	const found = classifications.value.find(c => c.$id === id);
	return found?.name || null;
}

export function getLevel1Categories(classifications: Ref<IClassification[] | null>): IClassification[] {
	if (!classifications.value) return [];
	return classifications.value.filter(c => c.level === 1);
}

export function getSubCategories(classifications: Ref<IClassification[] | null>, parentId: string | null): IClassification[] {
	if (!parentId || !classifications.value) return [];
	return classifications.value.filter(c => c.level === 2 && c.parentId === parentId);
}

// Helper to get all names for a bookmark based on the new structure
export function getBookmarkDisplayNames(
	classifications: Ref<IClassification[] | null>,
	bookmark: { level1Id?: string | null, level2Id?: string | null, level3Ids?: string[] | null }
): string[] {
	if (!classifications.value) return [];
	const names: string[] = [];
	const map = new Map(classifications.value.map(c => [ c.$id, c.name ]));

	if (bookmark.level1Id && map.has(bookmark.level1Id)) {
		names.push(map.get(bookmark.level1Id)!);
	}
	if (bookmark.level2Id && map.has(bookmark.level2Id)) {
		names.push(map.get(bookmark.level2Id)!);
	}
	bookmark.level3Ids?.forEach(id => {
		if (map.has(id)) {
			names.push(map.get(id)!);
		}
	});
	return names;
}