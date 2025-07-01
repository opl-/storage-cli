import { resolve } from 'node:path';
import type { Argv } from 'yargs';
import { createStorageRoot } from '../store.ts';

export function initCommand(yargs: Argv) {
	return yargs.command({
		command: 'init root <path>',
		describe: 'Creates a new storage root location.',
		builder: (y) => {
			return y
				.positional('path', {
					describe: 'Location of the new storage root directory.',
					type: 'string',
				})
		},
		async handler(args) {
			const rootPath = resolve(args.path!);

			await createStorageRoot({
				rootPath,
			});

			console.log(rootPath);
		},
	});
};
