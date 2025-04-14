import { mkdir, stat, utimes, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Argv } from 'yargs';

/**
 * @returns Time as UNIX milliseconds.
 */
async function parseTime(time: string): Promise<number> {
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

function timeToName(time: number): string {
	const epoch = new Date('2000-01-01T00:00:00Z').getTime();

	const adjustedTime = Math.floor((time - epoch) / 1000);
	if (adjustedTime < 0) throw new Error('Creation time is before the epoch time.');

	const CHARS = 'abcdefghijklmnopqrstuvwxyz';
	const out: string[] = [];

	let acc = adjustedTime;
	while (acc > 0) {
		const thing = acc % 26;
		out.push(CHARS[thing]);

		acc = Math.floor(acc / 26);
	}

	return out.padStart(7, 'a');
}

export function mkdirCommand(yargs: Argv) {
	return yargs.command({
		command: 'mkdir <name> [description]',
		describe: 'Creates a new storage directory.',
		builder: (y) => {
			return y
				.positional('name', {
					describe: 'Name put into directory\'s metadata.',
					type: 'string',
				})
				.positional('description', {
					describe: 'Description put into directory\'s metadata.',
					type: 'string',
				})
				.option('time', {
					alias: ['d'],
					describe: 'Specify a creation time, or a file to use its mtime.',
					default: 'now',
					nargs: 1,
				})
				/* .option('cwd', {
					alias: ['c'],
					describe: 'Change into the directory after creating it.',
					type: 'boolean',
				}) */
				.option('tag', {
					alias: ['t'],
					describe: 'Add tags to the directory metadata.',
					type: 'array',
				})
		},
		async handler(args) {
			const storageRootPath = '/mnt/storage';

			const trimmedName = args.name!.trim();

			if (trimmedName.trim().length === 0) {
				console.error('Name must not be empty.');
				throw process.exit(1);
			}

			const creationTime = await parseTime(args.time);
			const directoryName = timeToName(creationTime);

			const directoryPath = resolve(storageRootPath, directoryName);
			const metadataDirectoryPath = resolve(directoryPath, '.storage-meta');
			const metadataPath = resolve(metadataDirectoryPath, 'info.json');

			try {
				await mkdir(directoryPath);
			} catch (ex: any) {
				if (ex.code === 'EEXIST') {
					// TODO: should probably just keep incrementing the name id?
					console.error('Directory with that creation time already exists.');
				} else {
					console.error('error creating directory:', ex);
				}
				throw process.exit(1);
			}

			try {
				await mkdir(metadataDirectoryPath);
			} catch (ex: any) {
				console.error('error creating metadata directory:', ex);
				throw process.exit(1);
			}

			const metadata = {
				name: trimmedName,
				description: args.description ?? undefined,
				created: new Date(creationTime).toISOString(),
				tags: (args.tag?.length ?? 0) > 0 ? args.tag : undefined,
			};

			try {
				await writeFile(metadataPath, JSON.stringify(metadata, null, '\t'));
			} catch (ex: any) {
				console.error('error writing directory metadata:', ex);
				throw process.exit(1);
			}

			try {
				const creationTimeAsDate = new Date(creationTime);
				await utimes(directoryPath, creationTimeAsDate, creationTimeAsDate);
			} catch (ex: any) {
				console.error('error changing directory utimes:', ex);
				throw process.exit(1);
			}

			console.log(directoryPath);
		},
	});
};
