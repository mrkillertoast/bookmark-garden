import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { type Models, Query } from 'appwrite';
import type { IClassification } from '~/types';
import { useNuxtApp, useRuntimeConfig } from '#app'; // Import Nuxt composables

export const useClassificationStore = defineStore('classifications', () => {
	// --- State ---
	const classifications = ref<Map<string, IClassification>>(new Map());
	const isLoading = ref(false);
	const error = ref<string | null>(null); // Add error state
	const hasLoaded = ref(false); // Track if initial load happened

	// --- Computed ---
	const classificationNameMap = computed(() => {
		const map = new Map<string, string>();
		classifications.value.forEach((classification, id) => {
			map.set(id, classification.name);
		});
		return map;
	});

	// --- Getters / Methods ---

	function getClassification(id: string): IClassification | undefined {
		return classifications.value.get(id);
	}

	function getClassificationName(id: string): string {
		return classificationNameMap.value.get(id) || id;
	}

	function getClassificationNames(ids: string[] = []): string[] {
		const validIds = ids.filter(id => id);
		return validIds.map(id => getClassificationName(id));
	}

	function getParents(childId: string): IClassification[] {
		const child = getClassification(childId);
		if (!child || !child.parentIds || child.parentIds.length === 0) {
			return [];
		}
		return child.parentIds
			.map(parentId => getClassification(parentId))
			.filter((parent): parent is IClassification => !!parent);
	}

	/**
	 * Finds a classification by its name and level.
	 * @param name The name of the classification (case-sensitive).
	 * @param level The level (1, 2, or 3).
	 * @returns The IClassification object or undefined if not found.
	 */
	function findClassificationByNameAndLevel(name: string, level: 1 | 2 | 3): IClassification | undefined {
		// Convert Map values to an array for easier iteration/finding
		const classificationsArray = Array.from(classifications.value.values());
		return classificationsArray.find(c => c.name === name && c.level === level);
	}


	function isDescendantOf(childId: string, ancestorId: string): boolean {
		const visited = new Set<string>();

		function check(currentId: string): boolean {
			if (currentId === ancestorId) return true;
			if (visited.has(currentId)) return false;

			visited.add(currentId);
			const parents = getParents(currentId);

			if (parents.length === 0) return false;

			for (const parent of parents) {
				if (parent.$id === ancestorId) return true;
				if (check(parent.$id)) return true;
			}

			return false;
		}

		const directParents = getParents(childId);
		for (const parent of directParents) {
			if (parent.$id === ancestorId) return true;
			if (check(parent.$id)) return true;
		}

		return false;
	}

	// --- Actions ---

	/**
	 * Fetches classifications from Appwrite.
	 * @param forceRefresh - If true, fetches even if already loaded.
	 */
	async function fetchClassifications(forceRefresh: boolean = false) {
		if (isLoading.value || (hasLoaded.value && !forceRefresh)) {
			console.log(`Skipping classification fetch: isLoading=${isLoading.value}, hasLoaded=${hasLoaded.value}, forceRefresh=${forceRefresh}`);
			return;
		}

		isLoading.value = true;
		error.value = null; // Reset error before fetching
		console.log(`Fetching classifications (forceRefresh=${forceRefresh})...`);

		// Access Nuxt context inside the action
		const { $appwrite } = useNuxtApp();
		const config = useRuntimeConfig();
		const DATABASE_ID = config.public.appwriteDatabaseId;
		const COLLECTION_ID_CLASSIFICATIONS = config.public.appwriteClassificationsCollectionId;

		if (!DATABASE_ID || !COLLECTION_ID_CLASSIFICATIONS) {
			error.value = 'Appwrite configuration is missing.';
			isLoading.value = false;
			console.error('Missing Appwrite config for classifications.');
			return;
		}


		try {
			const response = await $appwrite.databases.listDocuments(
				DATABASE_ID,
				COLLECTION_ID_CLASSIFICATIONS,
				[Query.limit(5000)],
			);

			const newMap = new Map<string, IClassification>();
			response.documents.forEach((doc: Models.Document) => {
				const classificationData: IClassification = {
					$id: doc.$id,
					name: doc.name,
					level: doc.level,
					parentIds: doc.parentIds || [],
					$createdAt: doc.$createdAt,
					$updatedAt: doc.$updatedAt,
				};
				newMap.set(doc.$id, classificationData);
			});

			classifications.value = newMap;
			hasLoaded.value = true;
			console.log('Classifications loaded/refreshed into Pinia store:', classifications.value.size);
		} catch (err: any) {
			console.error('Error loading classifications into Pinia store:', err);
			error.value = `Failed to load classifications: ${err.message || 'Unknown error'}`;
			hasLoaded.value = false; // Mark as not loaded on error
		} finally {
			isLoading.value = false;
		}
	}

	// Auto-load on client-side initialization (if needed, but explicit fetch is often better)
	// if (import.meta.client && !hasLoaded.value && !isLoading.value) {
	//     fetchClassifications();
	// }

	return {
		classifications,
		classificationNameMap,
		isLoading,
		error, // Expose error state
		hasLoaded,
		getClassification,
		getClassificationName,
		getClassificationNames,
		getParents,
		findClassificationByNameAndLevel, // Expose the new finder method
		isDescendantOf,
		fetchClassifications, // Expose the explicit fetch method
		// Remove loadClassifications if fetchClassifications replaces its role
	};
});
