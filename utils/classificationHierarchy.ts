import { ref } from 'vue';
import { type Models, Query } from 'appwrite';
import type { IClassification } from '~/types';

// Create a reactive reference for the classifications map
const classificationMap = ref<Map<string, string>>(new Map());

// Get a single name from an ID
export function getClassificationName(id: string): string {
	return classificationMap.value.get(id) || id;
}

// Get multiple names from an array of IDs
export function getClassificationNames(ids: string[] = []): string[] {

	// Filter out undefined/null/empty values first
	const validIds = ids.filter(id => id);
	return validIds
		.map(id => classificationMap.value.get(id) || id)
}

// Function to load classifications from Appwrite
export async function loadClassifications() {
	const { $appwrite } = useNuxtApp();
	const config = useRuntimeConfig();
	const DATABASE_ID = config.public.appwriteDatabaseId;
	const COLLECTION_ID_CLASSIFICATIONS = config.public.appwriteClassificationsCollectionId;

	try {
		const response = await $appwrite.databases.listDocuments(
			DATABASE_ID,
			COLLECTION_ID_CLASSIFICATIONS,
			[Query.limit(1000)],
		);

		// Reset the map
		const newMap = new Map<string, string>();

		// Populate with fetched data
		response.documents.forEach((doc: Models.Document) => {
			newMap.set(doc.$id, (doc as unknown as IClassification).name);
		});

		// Update the reactive map
		classificationMap.value = newMap;
		console.log('Classifications loaded:', classificationMap.value.size);
		return true;
	} catch (err) {
		console.error('Error loading classifications:', err);
		return false;
	}
}

if (import.meta.client) {
	loadClassifications();
}