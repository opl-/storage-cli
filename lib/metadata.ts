export interface Metadata {
	name: string;
	description?: string;
	created: Date;
	tags?: Array<string>;
}

export function serializeMetadata(metadata: Metadata): string {
	return JSON.stringify({
		...metadata,
		created: metadata.created.toISOString(),
	}, null, '\t');
}

export function deserializeMetadata(metadata: string): Metadata {
	const data: Metadata = JSON.parse(metadata);

	data.created = new Date(data.created);

	return data;
}
