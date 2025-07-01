import { basename, sep as pathSeparator, relative, resolve } from 'node:path';
import type { Argv } from 'yargs';
import { findStorageRoot, isStorageDirectory, moveDirectory, parseDirectoryName, type DirectoryLocation } from '../store.ts';

export function mvCommand(yargs: Argv) {
	return yargs.command({
		command: 'mv <from> <to>',
		describe: 'Moves a storage directory.',
		builder: (y) => {
			return y
				.positional('from', {
					describe: 'Path of the directory to move.',
					type: 'string',
				})
				.positional('to', {
					describe: 'Path of the partition to move the directory to. May include a new slug for the directory.',
					type: 'string',
				})
		},
		async handler(args) {
			const sourcePath = resolve(args.from!);
			const targetPath = resolve(args.to!);

			const sourceName = parseDirectoryName(basename(sourcePath));
			if (sourceName === null) {
				throw new Error('The source path is not a valid storage directory path.');
			}

			if (!await isStorageDirectory(sourcePath)) {
				throw new Error(`The source path is not a storage directory, or its metadata is not visible.`);
			}

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

			const targetLocation: DirectoryLocation = {
				rootPath: targetStorageRootPath,
				partition,
				// Slug can be changed as part of the move.
				slug: newDirectorySlug ?? sourceName.slug,
				// Identifier should not change when moving.
				identifier: sourceName.identifier,
			};

			await moveDirectory({
				sourcePath,
				targetLocation,
			});
		},
	});
};
