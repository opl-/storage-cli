import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serializeMetadata, type Metadata } from './metadata.ts';
import { timeToName } from './util.ts';

export async function resolveStorageRoot(userValue: string | undefined): Promise<string> {
	if (userValue) return userValue;
	// TODO: resolve parent storage root (needs marker?)
	if (process.env.STORAGE_ROOT) return process.env.STORAGE_ROOT;
	return '/storage';
}

export interface CreateDirectoryOpts {
	rootPath: string;
	metadata: Metadata;
}

export async function createDirectory(opts: CreateDirectoryOpts): Promise<string> {
	const directoryName = timeToName(opts.metadata.created.getTime());

	const directoryPath = resolve(opts.rootPath, directoryName);
	const metadataPath = resolve(directoryPath, '.storage-meta.json');

	try {
		await mkdir(directoryPath);
	} catch (ex: any) {
		if (ex.code === 'EEXIST') {
			// TODO: should probably just keep incrementing the name id?
			throw new Error('Directory with that creation time already exists.', { cause: ex });
		}

		throw new Error('Error creating directory.', { cause: ex });
	}

	try {
		await writeFile(metadataPath, serializeMetadata(opts.metadata));
	} catch (ex: any) {
		throw new Error('Error writing directory metadata.', { cause: ex });
	}

	try {
		await utimes(directoryPath, opts.metadata.created, opts.metadata.created);
	} catch (ex: any) {
		throw new Error('Error changing directory utimes.', { cause: ex });
	}

	return directoryPath;
}
