import { access, constants as fsConstants, mkdir, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join as joinPath, relative, resolve } from 'node:path';
import { serializeMetadata, type Metadata } from './metadata.ts';
import { timeToName } from './util.ts';

export const ROOT_METADATA_FILENAME = '.storage-root.json';
export const DIRECTORY_METADATA_FILENAME = '.storage-meta.json';

export interface PartitionLocation {
	rootPath: string;
	partition: string;
}

export interface DirectoryName {
	identifier: string;
	slug: string | null;
}

export interface DirectoryLocation extends DirectoryName, PartitionLocation {
}

export async function resolveStorageRoot(userValue: string | undefined): Promise<string> {
	if (userValue) return userValue;
	if (process.env.STORAGE_ROOT) return process.env.STORAGE_ROOT;

	const foundRoot = await findStorageRoot({
		path: process.cwd(),
	});
	if (foundRoot) return foundRoot;

	if (process.env.STORAGE_DEFAULT_ROOT) return process.env.STORAGE_DEFAULT_ROOT;
	return '/storage';
}

export async function isStorageRoot(storageRoot: string): Promise<boolean> {
	const storageRootMetadataPath = resolve(storageRoot, ROOT_METADATA_FILENAME);

	try {
		await access(storageRootMetadataPath, fsConstants.F_OK);
	} catch (ex: any) {
		return false;
	}

	return true;
}

export async function isStorageDirectory(storageRoot: string): Promise<boolean> {
	const directoryMetadataPath = resolve(storageRoot, DIRECTORY_METADATA_FILENAME);

	try {
		await access(directoryMetadataPath, fsConstants.F_OK);
	} catch (ex: any) {
		return false;
	}

	return true;
}

export interface FindStorageRootOpts {
	path: string;

	/**
	 * Limit for how many directories up the storage root metadata file can be. Defaults to `Infinity`.
	 */
	maxDepth?: number;
}

export async function findStorageRoot({ path, maxDepth = Infinity }: FindStorageRootOpts): Promise<string | null> {
	if (!isAbsolute(path)) throw new Error('Search start path must be absolute.');

	// Remove path traversal nodes and trailing slash.
	let currentPath = resolve(path);

	let limit = maxDepth;
	while (limit > 0) {
		limit--;

		if (await isStorageRoot(currentPath)) {
			return currentPath;
		}

		const previousPath = currentPath;
		currentPath = resolve(currentPath, '..');

		if (previousPath === currentPath) {
			// We've reached the root directory - check at most one last time and then stop looping.
			if (limit > 1) limit = 1;
		}
	}

	return null;
}

// Ref: https://stackoverflow.com/a/31976060
const HIDDEN_CHARS = /[\s\/\\<>:"|?*\u0000-\u0031]+/g;
export function nameToSlug(name: string): string {
	return name.toLocaleLowerCase().replace(HIDDEN_CHARS, '-').replace(/(^-+|-+$)/g, '');
}

export function isValidPartitionName(name: string): boolean {
	return !['all', 'by-id'].includes(name);
}

export interface CreateStorageRootOpts {
	rootPath: string;
}

export async function createStorageRoot({ rootPath }: CreateStorageRootOpts): Promise<void> {
	if (!isAbsolute(rootPath)) throw new Error('rootPath of a new storage root must be absolute.');

	const storageRootMetadataPath = resolve(rootPath, ROOT_METADATA_FILENAME);

	await mkdir(rootPath, {
		recursive: true,
	});

	try {
		await writeFile(storageRootMetadataPath, '{\n}', {
			// Fail if the file already exists to prevent overriding an existing storage root metadata.
			flag: 'wx',
		});
	} catch (ex: any) {
		if (ex.code === 'EEXIST') {
			throw new Error('Specified path already has a storage root metadata file.', {
				cause: ex,
			});
		}

		throw ex;
	}

	await mkdir(resolve(rootPath, 'all'));
	await mkdir(resolve(rootPath, 'by-id'));
}

export interface CreateDirectoryLocationOpts {
	rootPath: string;
	metadata: Metadata;
	preferredPartition?: string;
}

export function createDirectoryLocation({ rootPath, metadata, preferredPartition }: CreateDirectoryLocationOpts): DirectoryLocation {
	const identifier = timeToName(metadata.created.getTime());
	const slug = nameToSlug(metadata.name);

	return {
		rootPath,
		partition: preferredPartition ?? 'frequent',
		identifier,
		slug,
	};
}

export function parseDirectoryName(directoryName: string): DirectoryName | null {
	const parsedDirectoryName = /^(?:(.*)-)?([^\-]+)$/.exec(directoryName);
	if (parsedDirectoryName === null) return null;

	return {
		slug: parsedDirectoryName[1] ?? null,
		identifier: parsedDirectoryName[2],
	};
}

export function parseDirectoryLocation(path: string): DirectoryLocation | null {
	if (!isAbsolute(path)) return null;

	const partitionPath = joinPath(path, '..');
	const rootPath = joinPath(path, '../..');

	if (partitionPath === rootPath) {
		// There are too few segments to contain both a partition and a storage directory name.
		return null;
	}

	const directoryName = parseDirectoryName(basename(path));
	if (directoryName === null) return null;

	return {
		rootPath,
		partition: basename(partitionPath),
		...directoryName,
	};
}

export function resolveDirectoryName(directoryName: DirectoryName): string {
	return (directoryName.slug ? directoryName.slug + '-' : '') + directoryName.identifier;
}

export function resolveDirectoryLocation(location: DirectoryLocation): string {
	if (!isValidPartitionName(location.partition)) {
		throw new Error(`Partition name ${JSON.stringify(location.partition)} is reserved and can't be used.`);
	}

	return resolve(
		location.rootPath,
		location.partition,
		resolveDirectoryName(location),
	);
}

export interface CreateLinksOpts {
	location: DirectoryLocation;
}

export async function createLinks({ location }: CreateLinksOpts): Promise<void> {
	const directoryPath = resolveDirectoryLocation(location);

	const allLinkPath = resolve(location.rootPath, 'all/', basename(directoryPath));
	const byIdLinkPath = resolve(location.rootPath, 'by-id/', location.identifier);

	await Promise.all([
		symlink(relative(resolve(allLinkPath, '..'), directoryPath), allLinkPath),
		symlink(relative(resolve(byIdLinkPath, '..'), directoryPath), byIdLinkPath),
	]);
}

export interface RemoveLinksOpts {
	location: DirectoryLocation;
}

export async function removeLinks({ location }: CreateLinksOpts): Promise<void> {
	const directoryPath = resolveDirectoryLocation(location);

	const allLinkPath = resolve(location.rootPath, 'all/', basename(directoryPath));
	const byIdLinkPath = resolve(location.rootPath, 'by-id/', location.identifier);

	await Promise.all([
		unlink(allLinkPath),
		unlink(byIdLinkPath),
	]);
}

export interface CreateDirectoryOpts {
	location: DirectoryLocation;
	metadata: Metadata;
}

export async function createDirectory(opts: CreateDirectoryOpts): Promise<string> {
	const directoryPath = resolveDirectoryLocation(opts.location);
	const metadataPath = resolve(directoryPath, DIRECTORY_METADATA_FILENAME);

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

	await createLinks({
		location: opts.location,
	});

	return directoryPath;
}
