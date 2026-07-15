export function base64ToBlob(base64: string, mimeType: string): Blob {
	const byteChars = atob(base64);
	const byteNumbers = new Array(byteChars.length);
	for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
	return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}
