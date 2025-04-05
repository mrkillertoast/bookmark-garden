import type { ICategory } from '~/types'; // Adjust path if types is not in root

export const classificationHierarchy: ICategory[] = [
	{
		id: 'dev',
		name: 'Development',
		subCategories: [
			{
				id: 'frontend',
				name: 'Frontend',
				level3Tags: [
					{ id: 'react', name: 'React' },
					{ id: 'vue', name: 'Vue' },
					{ id: 'tailwind', name: 'Tailwind CSS' },
					{ id: 'nuxt', name: 'Nuxt.js' },
				],
			},
			{
				id: 'backend',
				name: 'Backend',
				level3Tags: [
					{ id: 'node', name: 'Node.js' },
					{ id: 'python', name: 'Python' },
					{ id: 'docker', name: 'Docker' },
				],
			},
			{ id: 'devops', name: 'DevOps', level3Tags: [ { id: 'ci-cd', name: 'CI/CD' } ] },
			{ id: 'mobile', name: 'Mobile', level3Tags: [ { id: 'react-native', name: 'React Native' } ] },
		],
	},
	{
		id: 'learn',
		name: 'Learning',
		subCategories: [
			{ id: 'courses', name: 'Courses' },
			{ id: 'docs', name: 'Documentation' },
			{ id: 'blogs', name: 'Blogs' },
		],
	},
	{
		id: 'prod',
		name: 'Productivity',
		subCategories: [
			{ id: 'tools', name: 'Tools', level3Tags: [ { id: 'notion', name: 'Notion' } ] },
			{ id: 'methods', name: 'Methods' },
		],
	},
	{
		id: 'ent',
		name: 'Entertainment',
		subCategories: [
			{ id: 'movies', name: 'Movies' },
			{ id: 'music', name: 'Music' },
			{ id: 'games', name: 'Games' },
		],
	},
];

// --- Helper Functions ---

// Create a flat map for easy ID-to-name lookup
const flatHierarchyMap = new Map<string, string>();

function populateMap(categories: ICategory[]) {
	categories.forEach(l1 => {
		flatHierarchyMap.set(l1.id, l1.name);
		l1.subCategories.forEach(l2 => {
			flatHierarchyMap.set(l2.id, l2.name);
			l2.level3Tags?.forEach(l3 => {
				flatHierarchyMap.set(l3.id, l3.name);
			});
		});
	});
}

populateMap(classificationHierarchy); // Populate the map on initialization

// Get a single name from an ID
export function getClassificationName(id: string): string {
	return flatHierarchyMap.get(id) || id;
}

// Get multiple names from an array of IDs
export function getClassificationNames(ids: string[]): string[] {
	return ids.map(id => flatHierarchyMap.get(id)).filter((name): name is string => !!name);
}