// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import { process } from "std-env";

export default defineNuxtConfig({
	compatibilityDate: '2024-11-01',
	devtools: { enabled: true },
	css: [ '~/assets/css/tailwind.css', "~/assets/css/main.css" ],
	ssr: false, // Disable Server-Side Rendering

	vite: {
		plugins: [
			tailwindcss(),
		],
	},

	modules: [ 'shadcn-nuxt', '@nuxt/icon', '@pinia/nuxt' ],

	shadcn: {
		prefix: '',
		componentDir: './components/ui'
	},

	runtimeConfig: {
		public: {
			appwriteEndpoint: process.env.NUXT_PUBLIC_APPWRITE_ENDPOINT,
			appwriteProjectId: process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID,
			appwriteDatabaseId: process.env.NUXT_PUBLIC_APPWRITE_DATABASE_ID,
			appwriteBookmarksCollectionId: process.env.NUXT_PUBLIC_APPWRITE_BOOKMARKS_COLLECTION_ID,
			appwriteClassificationsCollectionId: process.env.NUXT_PUBLIC_APPWRITE_CLASSIFICATIONS_COLLECTION_ID,
			appwriteFunctionIdAddBookmark: process.env.NUXT_PUBLIC_APPWRITE_FUNCTION_ID_ADD_BOOKMARK,
		}
	},
})