import { Client, Account, Databases, Avatars, Functions } from 'appwrite';

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();

	const client = new Client()
		.setEndpoint(config.public.appwriteEndpoint as string)
		.setProject(config.public.appwriteProjectId as string);

	const account = new Account(client);
	const databases = new Databases(client);
	const avatars = new Avatars(client);
	const functions = new Functions(client);

	return {
		provide: {
			appwrite: {
				client,
				account,
				databases,
				avatars,
				functions
			}
		}
	};
});