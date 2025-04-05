import { Client, Account, Databases, Avatars } from 'appwrite';

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();

	const client = new Client()
		.setEndpoint(config.public.appwriteEndpoint as string)
		.setProject(config.public.appwriteProjectId as string);

	const account = new Account(client);
	const databases = new Databases(client);
	const avatars = new Avatars(client);

	return {
		provide: {
			appwrite: {
				client,
				account,
				databases,
				avatars,
			}
		}
	};
});