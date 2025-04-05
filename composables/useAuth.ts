import { ref } from 'vue';
import type { Models } from 'appwrite';

export const useAuth = () => {
	const { $appwrite } = useNuxtApp();
	const currentUser = ref<Models.User<Models.Preferences> | null>(null);
	const isLoading = ref(true);
	const error = ref<Error | null>(null);

	// Check current session
	const fetchCurrentUser = async () => {
		try {
			isLoading.value = true;
			currentUser.value = await $appwrite.account.get();
		} catch (err) {
			error.value = err as Error;
			currentUser.value = null;
		} finally {
			isLoading.value = false;
		}
	};

	/**
	 * Login with email and password function
	 * @param {string} email - User email
	 * @param {string} password - User password
	 * @return {session} - Appwrite session object
	 */
	const login = async (email: string, password: string) => {
		try {
			isLoading.value = true;
			error.value = null;

			const session = await $appwrite.account.createEmailPasswordSession(email, password);
			await fetchCurrentUser();

			return session;
		} catch (err) {
			error.value = err as Error;
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	// Logout
	const logout = async () => {
		try {
			isLoading.value = true;
			error.value = null;

			await $appwrite.account.deleteSession('current');
			currentUser.value = null;
		} catch (err) {
			error.value = err as Error;
			throw err;
		} finally {
			isLoading.value = false;
		}
	};

	const isLoggedIn = () => {
		return currentUser.value !== null;
	}

	// Initialize auth state
	onMounted(() => {
		fetchCurrentUser()
	});

	return {
		isLoading,
		currentUser,
		isLoggedIn,
		login,
		logout,
		fetchCurrentUser
	};
};