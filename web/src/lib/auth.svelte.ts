import type { User } from '@recoral/shared';

let user = $state<User | null>(null);
let loading = $state(true);

async function refresh() {
	loading = true;
	try {
		const res = await fetch('/api/auth/me', { credentials: 'include' });
		user = res.ok ? await res.json() : null;
	} finally {
		loading = false;
	}
}

async function submit(path: string, email: string, password: string) {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ email, password })
	});
	const body = await res.json();
	if (!res.ok) throw new Error(body.error ?? 'Something went wrong');
	user = body as User;
}

async function login(email: string, password: string) {
	await submit('/api/auth/login', email, password);
}

async function register(email: string, password: string) {
	await submit('/api/auth/register', email, password);
}

async function logout() {
	await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
	user = null;
}

export const auth = {
	get user() {
		return user;
	},
	get loading() {
		return loading;
	},
	refresh,
	login,
	register,
	logout
};
