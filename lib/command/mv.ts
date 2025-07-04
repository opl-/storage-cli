import { glob } from 'node:fs/promises';
import { basename, sep as pathSeparator, relative, resolve } from 'node:path';
import type { Argv } from 'yargs';
import { findStorageRoot, isStorageDirectory, moveDirectory, parseDirectoryName, type DirectoryLocation } from '../store.ts';

export function mvCommand(yargs: Argv) {
	return yargs.command({
		command: 'mv <from...>',
		describe: 'Moves a storage directory.',
		builder: (y) => {
			return y
				.positional('from', {
					describe: 'Path of the directory to move.',
					type: 'string',
					array: true,
					demandOption: true,
				})
				.positional('to', {
					describe: 'Path of the partition to move the directory to. May include a new slug for the directory.',
					type: 'string',
				})
		},
		async handler(args) {
			// yargs hack: we can't have an array argument with a trailing positional without forcing the user to end the array with `--`.
			// Treat last value of `from` as the value of `to`.
			// Ref: https://github.com/yargs/yargs/issues/2116
			if (args.from.length < 2) {
				throw new Error(`Missing argument: to`);
			}
			const fromArg = args.from.slice(0, -1);
			const toArg = args.from[args.from.length - 1];

			const targetPath = resolve(toArg);

			const targetStorageRootPath = await findStorageRoot({
				// TODO: this prevents specifying a path directly to a storage root. considering this by design for now, as there's no clear way of choosing a default partition.
				path: resolve(targetPath, '..'),
				maxDepth: 2,
			});
			if (targetStorageRootPath === null) {
				throw new Error('Target path is not a valid storage partition nor a direct child of one.');
			}

			const targetRootRelativePath = relative(targetStorageRootPath, targetPath);

			// newDirectorySlug will be undefined if the relative path contains just one segment.
			const [ partition, newDirectorySlug ] = targetRootRelativePath.split(pathSeparator);

			const sourcePaths: Array<string> = [];
			for await (const sourcePath of glob(fromArg)) {
				sourcePaths.push(resolve(sourcePath));
			}

			if (sourcePaths.length === 0) {
				throw new Error('No matching directories found.');
			}

			if (newDirectorySlug !== undefined && sourcePaths.length > 1) {
				throw new Error('Can\'t change a directory slug while moving multiple directories. Use a partition as a target path.');
			}

			for (const sourcePath of sourcePaths) {
				try {
					const sourceName = parseDirectoryName(basename(sourcePath));
					if (sourceName === null) {
						throw new Error(`The source path ${sourcePath} is not a valid storage directory path.`);
					}

					if (!await isStorageDirectory(sourcePath)) {
						throw new Error(`The source path ${sourcePath} is not a storage directory, or its metadata is not visible.`);
					}

					const targetLocation: DirectoryLocation = {
						rootPath: targetStorageRootPath,
						partition,
						// Slug can be changed as part of the move.
						slug: newDirectorySlug ?? sourceName.slug,
						// Identifier should not change when moving.
						identifier: sourceName.identifier,
					};

					await moveDirectory({
						source: sourcePath,
						target: targetLocation,
					});
				} catch (ex: any) {
					process.exitCode = 1;

					console.error(ex);
				}
			}
		},
	});
};
