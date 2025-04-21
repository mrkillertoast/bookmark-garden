import { defineStore } from 'pinia';
import { ref } from 'vue';
import { type Models, Query } from 'appwrite';
import type { IClassification } from '~/types';

// Define the store
export const useClassificationStore = defineStore('classifications', () => {
	// --- State ---
	const classificationMap = ref<Map<string, string>>(new Map());
	const isLoading = ref(false);
	const hasLoaded = ref(false); // Track if initial load has happened

	// --- Getters (as computed or methods) ---

	/**
	 * Gets the name for a single classification ID.
	 * @param id - The classification ID.
	 * @returns The name or the ID if not found.
	 */
	function getClassificationName(id: string): string {
		return classificationMap.value.get(id) || id;
	}

	/**
	 * Gets the names for an array of classification IDs.
	 * @param ids - Array of classification IDs.
	 * @returns Array of names (or IDs if not found).
	 */
	function getClassificationNames(ids: string[] = []): string[] {
		// Filter out undefined/null/empty values first
		const validIds = ids.filter(id => id);
		return validIds.map(id => classificationMap.value.get(id) || id);
	}

	// --- Actions ---

	/**
	 * Loads classifications from Appwrite if they haven't been loaded yet.
	 */
	async function loadClassifications() {
		// Prevent multiple concurrent loads or re-loads
		if (isLoading.value || hasLoaded.value) {
			// console.log('Classifications already loaded or loading.');
			return;
		}

		isLoading.value = true;
		console.log('Loading classifications into Pinia store...');

		const { $appwrite } = useNuxtApp();
		const config = useRuntimeConfig();
		const DATABASE_ID = config.public.appwriteDatabaseId;
		const COLLECTION_ID_CLASSIFICATIONS = config.public.appwriteClassificationsCollectionId;

		try {
			const response = await $appwrite.databases.listDocuments(
				DATABASE_ID,
				COLLECTION_ID_CLASSIFICATIONS,
				[Query.limit(1000)], // Adjust limit as needed
			);

			const newMap = new Map<string, string>();
			response.documents.forEach((doc: Models.Document) => {
				newMap.set(doc.$id, (doc as unknown as IClassification).name);
			});

			classificationMap.value = newMap;
			hasLoaded.value = true; // Mark as loaded
			console.log('Classifications loaded into Pinia store:', classificationMap.value.size);
		} catch (err) {
			console.error('Error loading classifications into Pinia store:', err);
			// Optionally reset state or set an error flag
			hasLoaded.value = false; // Allow retrying if needed
		} finally {
			isLoading.value = false;
		}
	}

	// --- Auto-load on client-side initialization (optional but common) ---
	// This ensures data is fetched when the store is first used on the client.
	// Alternatively, you could call loadClassifications from app.vue or a plugin.
	if (import.meta.client && !hasLoaded.value && !isLoading.value) {
		loadClassifications();
	}

	// --- Return state, getters, and actions ---
	return {
		classificationMap,
		isLoading,
		hasLoaded,
		getClassificationName,
		getClassificationNames,
		loadClassifications,
	};
});