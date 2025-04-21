import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; // Import computed
import { type Models, Query } from 'appwrite';
import type { IClassification } from '~/types';

export const useClassificationStore = defineStore('classifications', () => {
	// --- State ---
	// Store the full classification objects, keyed by ID
	const classifications = ref<Map<string, IClassification>>(new Map());
	const isLoading = ref(false);
	const hasLoaded = ref(false);

	// --- Computed --- map for quick name lookups (derived from classifications)
	const classificationNameMap = computed(() => {
		const map = new Map<string, string>();
		classifications.value.forEach((classification, id) => {
			map.set(id, classification.name);
		});
		return map;
	});

	// --- Getters / Methods ---

	/**
	 * Gets the full classification object for a given ID.
	 * @param id - The classification ID.
	 * @returns The IClassification object or undefined.
	 */
	function getClassification(id: string): IClassification | undefined {
		return classifications.value.get(id);
	}

	/**
	 * Gets the name for a single classification ID.
	 * @param id - The classification ID.
	 * @returns The name or the ID if not found.
	 */
	function getClassificationName(id: string): string {
		return classificationNameMap.value.get(id) || id; // Use the computed map
	}

	/**
	 * Gets the names for an array of classification IDs.
	 * @param ids - Array of classification IDs.
	 * @returns Array of names (or IDs if not found).
	 */
	function getClassificationNames(ids: string[] = []): string[] {
		const validIds = ids.filter(id => id);
		return validIds.map(id => getClassificationName(id)); // Use the getter
	}

	/**
	 * Finds the parent classifications for a given classification ID.
	 * @param childId - The ID of the classification whose parents are needed.
	 * @returns An array of parent IClassification objects.
	 */
	function getParents(childId: string): IClassification[] {
		const child = getClassification(childId);
		if (!child || !child.parentIds || child.parentIds.length === 0) {
			return [];
		}
		return child.parentIds
			.map(parentId => getClassification(parentId))
			.filter((parent): parent is IClassification => !!parent); // Filter out undefined results
	}

    /**
	 * Checks if a classification ID descends from a specific ancestor ID.
     * @param childId The ID to check.
     * @param ancestorId The potential ancestor ID to check against.
     * @returns True if childId is a descendant of ancestorId.
     */
    function isDescendantOf(childId: string, ancestorId: string): boolean {
        const visited = new Set<string>(); // Prevent infinite loops in case of cycles

        function check(currentId: string): boolean {
            if (currentId === ancestorId) return true; // Direct match (shouldn't happen if checking parents)
            if (visited.has(currentId)) return false; // Already checked this node

            visited.add(currentId);
            const parents = getParents(currentId);

            if (parents.length === 0) return false; // Reached root without match

            // Check if any parent is the ancestor or descends from the ancestor
            for (const parent of parents) {
                if (parent.$id === ancestorId) return true;
                if (check(parent.$id)) return true; // Recurse upwards
            }

            return false;
        }

         // Start checking from the parents of the initial childId
         const directParents = getParents(childId);
         for (const parent of directParents) {
            if (parent.$id === ancestorId) return true;
            if (check(parent.$id)) return true;
         }

         return false;
    }


	// --- Actions ---

	/**
	 * Loads classifications from Appwrite if they haven't been loaded yet.
	 */
	async function loadClassifications() {
		if (isLoading.value || hasLoaded.value) {
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
				[Query.limit(5000)], // Ensure limit is high enough
			);

			const newMap = new Map<string, IClassification>();
			response.documents.forEach((doc: Models.Document) => {
				// Map Appwrite doc to IClassification, handling the new parentIds
				const classificationData: IClassification = {
					$id: doc.$id,
					name: doc.name,
					level: doc.level,
					parentIds: doc.parentIds || [], // Default to empty array if missing
					$createdAt: doc.$createdAt,
					$updatedAt: doc.$updatedAt,
				};
				newMap.set(doc.$id, classificationData);
			});

			classifications.value = newMap; // Update the main state
			hasLoaded.value = true;
			console.log('Classifications loaded into Pinia store:', classifications.value.size);
		} catch (err) {
			console.error('Error loading classifications into Pinia store:', err);
			hasLoaded.value = false;
		} finally {
			isLoading.value = false;
		}
	}

	// Auto-load on client-side initialization
	if (import.meta.client && !hasLoaded.value && !isLoading.value) {
		loadClassifications();
	}

	return {
		classifications, // Expose the raw map if needed elsewhere
		classificationNameMap, // Expose the name map
		isLoading,
		hasLoaded,
		getClassification,
		getClassificationName,
		getClassificationNames,
		getParents,
        isDescendantOf, // Expose the hierarchy check function
		loadClassifications,
	};
});