import { CosmosClient } from '@azure/cosmos'

let _container = null

function getContainer() {
	if (_container) return _container

	if (!process.env.COSMOS_CONNECTION_STRING) {
		throw new Error('COSMOS_CONNECTION_STRING is not set — restart the dev server after adding .env.local')
	}

	const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING)
	_container = client.database('uow-datalens-db').container('datasets')
	return _container
}

const CHUNK_SIZE = 1000

export async function listDatasets() {
	const container = getContainer()
	const { resources } = await container.items
		.query('SELECT c.id, c.name, c.columns, c.rowCount, c.uploadedAt FROM c WHERE c.type = "metadata" ORDER BY c.uploadedAt ASC')
		.fetchAll()
	return resources
}

export async function saveDataset({ id, name, columns, rowCount, rows }) {
	const container = getContainer()
	const chunkCount = Math.ceil(rows.length / CHUNK_SIZE) || 1

	const metadata = {
		id,
		type: 'metadata',
		name,
		columns,
		rowCount,
		chunkCount,
		uploadedAt: new Date().toISOString()
	}

	const chunks = Array.from({ length: chunkCount }, (_, i) => ({
		id: `${id}_chunk_${i}`,
		type: 'chunk',
		datasetId: id,
		chunkIndex: i,
		rows: rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
	}))

	await Promise.all([
		container.items.upsert(metadata),
		...chunks.map((chunk) => container.items.upsert(chunk))
	])

	return metadata
}

export async function getDataset(id) {
	const container = getContainer()
	const { resource: metadata } = await container.item(id, id).read()
	if (!metadata) return null

	const results = await Promise.all(
		Array.from({ length: metadata.chunkCount }, (_, i) =>
			container.item(`${id}_chunk_${i}`, `${id}_chunk_${i}`).read()
		)
	)

	const rows = results.flatMap((r) => r.resource?.rows ?? [])
	return { ...metadata, rows }
}

export async function deleteDataset(id) {
	const container = getContainer()
	const { resource: metadata } = await container.item(id, id).read()
	if (!metadata) return

	await Promise.all([
		container.item(id, id).delete(),
		...Array.from({ length: metadata.chunkCount }, (_, i) =>
			container.item(`${id}_chunk_${i}`, `${id}_chunk_${i}`).delete()
		)
	])
}

export async function updateDatasetRows(id, updatedRows) {
	const container = getContainer()
	const { resource: metadata } = await container.item(id, id).read()
	if (!metadata) return null

	const newChunkCount = Math.ceil(updatedRows.length / CHUNK_SIZE) || 1

	const upserts = Array.from({ length: newChunkCount }, (_, i) =>
		container.items.upsert({
			id: `${id}_chunk_${i}`,
			type: 'chunk',
			datasetId: id,
			chunkIndex: i,
			rows: updatedRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
		})
	)

	const deletes = Array.from(
		{ length: Math.max(0, metadata.chunkCount - newChunkCount) },
		(_, i) => container.item(`${id}_chunk_${newChunkCount + i}`, `${id}_chunk_${newChunkCount + i}`).delete()
	)

	const updatedMetadata = { ...metadata, rowCount: updatedRows.length, chunkCount: newChunkCount }

	await Promise.all([...upserts, ...deletes, container.items.upsert(updatedMetadata)])

	return updatedMetadata
}
