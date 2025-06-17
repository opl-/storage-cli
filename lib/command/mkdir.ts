import type { Argv } from 'yargs';
import { createDirectory } from '../store.ts';
import { parseTime } from '../util.ts';

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
					type: 'string',
				})
		},
		async handler(args) {
			const storageRootPath = '/mnt/storage';

			const trimmedName = args.name!.trim();

			if (trimmedName.trim().length === 0) {
				throw new Error('Directory name must not be empty.');
			}

			const creationTime = await parseTime(args.time);

			const directoryPath = await createDirectory({
				rootPath: storageRootPath,
				metadata: {
					name: trimmedName,
					description: args.description ?? undefined,
					created: new Date(creationTime),
					tags: Array.isArray(args.tag) ? args.tag : typeof(args.tag) === 'string' ? [args.tag] : [],
				},
			});

			console.log(directoryPath);
		},
	});
};
