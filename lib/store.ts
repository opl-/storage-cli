import { mkdir, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join as joinPath, relative, resolve } from 'node:path';
import { serializeMetadata, type Metadata } from './metadata.ts';
import { timeToName } from './util.ts';

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
	// TODO: resolve parent storage root (needs marker?)
	if (process.env.STORAGE_ROOT) return process.env.STORAGE_ROOT;
	return '/storage';
}

// Ref: https://stackoverflow.com/a/31976060
const HIDDEN_CHARS = /[\s\/\\<>:"|?*\u0000-\u0031]+/g;
export function nameToSlug(name: string): string {
	return name.toLocaleLowerCase().replace(HIDDEN_CHARS, '-').replace(/(^-+|-+$)/g, '');
}

export function isValidPartitionName(name: string): boolean {
	return !['all', 'by-id'].includes(name);
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

	await createLinks({
		location: opts.location,
	});

	return directoryPath;
}
