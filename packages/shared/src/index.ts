export interface Recording {
	id: string;
	title: string;
	createdAt: string;
	durationSeconds: number;
	transcript: string | null;
}

export interface User {
	id: string;
	email: string;
	createdAt: string;
}
