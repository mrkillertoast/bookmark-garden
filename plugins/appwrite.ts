import { Client, Account, Databases, Avatars } from 'appwrite';

export default defineNuxtPlugin(() => {
	const runtimeConfig = useRuntimeConfig();

	const client = new Client()
		.setEndpoint(runtimeConfig.public.appwriteEndpoint as string)
		.setProject(runtimeConfig.public.appwriteProjectId as string);

	const account = new Account(client);
	const databases = new Databases(client);
	const avatars = new Avatars(client);

	console.log('Appwrite plugin initialized'); // For debugging

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