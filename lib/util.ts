import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * @returns Time as UNIX milliseconds.
 */
export async function parseTime(time: string): Promise<number> {
	if (time === 'now') return Date.now();

	if (time.startsWith('.') || time.startsWith('/')) {
		// Assume time is a path.
		const filePath = resolve(time);
		try {
			const fileStat = await stat(filePath);
			return fileStat.mtimeMs;
		} catch (ex) {
			console.error(`Unable to extract mtime of file ${filePath}:`, ex);
			throw process.exit(1);
		}
	}

	const date = new Date(time);

	if (isNaN(date.getTime())) {
		throw new Error(`Invalid time format: ${time}`);
	}

	return date.getTime();
}

export function timeToName(time: number): string {
	const epoch = new Date('2000-01-01T00:00:00Z').getTime();

	const adjustedTime = Math.floor((time - epoch) / 1000);
	if (adjustedTime < 0) throw new Error('Creation time is before the epoch time.');

	const CHARS = 'abcdefghijklmnopqrstuvwxyz';
	let out = '';

	let acc = adjustedTime;
	while (acc > 0) {
		const thing = acc % 26;
		out = CHARS[thing] + out;

		acc = Math.floor(acc / 26);
	}

	return out.padStart(7, 'a');
}
