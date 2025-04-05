// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import { process } from "std-env";

export default defineNuxtConfig({
	compatibilityDate: '2024-11-01',
	devtools: { enabled: true },
	css: [ '~/assets/css/tailwind.css', "~/assets/css/main.css" ],

	vite: {
		plugins: [
			tailwindcss(),
		],
	},

	modules: [ 'shadcn-nuxt', '@nuxt/icon' ],

	shadcn: {
		prefix: '',
		componentDir: './components/ui'
	},

	runtimeConfig: {
		public: {
			appwriteEndpoint: process.env.NUXT_PUBLIC_APPWRITE_ENDPOINT,
			appwriteProjectId: process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID,
			appwriteDatabaseId: process.env.NUXT_PUBLIC_APPWRITE_DATABASE_ID,
			appwriteCollectionId: process.env.NUXT_PUBLIC_APPWRITE_COLLECTION_ID,
		}
	},
})