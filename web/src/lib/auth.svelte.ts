import type { User } from '@recoral/shared';
import { applyAccentHue } from './accent';

let user = $state<User | null>(null);
let loading = $state(true);

function setUser(next: User | null) {
	user = next;
	applyAccentHue(next?.accentHue ?? 26);
}

async function refresh() {
	loading = true;
	try {
		const res = await fetch('/api/auth/me', { credentials: 'include' });
		setUser(res.ok ? await res.json() : null);
	} finally {
		loading = false;
	}
}

async function submit(path: string, body: Record<string, unknown>) {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body)
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
	setUser(data as User);
}

async function login(identifier: string, password: string) {
	await submit('/api/auth/login', { identifier, password });
}

async function register(username: string, password: string, email: string, accentHue: number) {
	await submit('/api/auth/register', { username, password, email: email || null, accentHue });
}

async function updateAccount(updates: { accentHue?: number; avatar?: string | null }) {
	const res = await fetch('/api/account', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(updates)
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
	setUser(data as User);
}

async function logout() {
	await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
	setUser(null);
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
	updateAccount,
	logout
};
