import { getDataset, deleteDataset, updateDatasetRows } from '@/lib/cosmos'

export async function GET(request, { params }) {
	const { id } = await params
	try {
		const dataset = await getDataset(id)
		if (!dataset) {
			return Response.json({ error: 'Dataset not found.' }, { status: 404 })
		}
		return Response.json(dataset)
	} catch (error) {
		console.error(`GET /api/datasets/${id} error:`, error)
		return Response.json({ error: error.message || 'Failed to load dataset.' }, { status: 500 })
	}
}

export async function DELETE(request, { params }) {
	const { id } = await params
	try {
		await deleteDataset(id)
		return Response.json({ success: true })
	} catch (error) {
		console.error(`DELETE /api/datasets/${id} error:`, error)
		return Response.json({ error: error.message || 'Failed to delete dataset.' }, { status: 500 })
	}
}

export async function PATCH(request, { params }) {
	const { id } = await params
	try {
		const { rows } = await request.json()
		const metadata = await updateDatasetRows(id, rows)
		if (!metadata) {
			return Response.json({ error: 'Dataset not found.' }, { status: 404 })
		}
		return Response.json(metadata)
	} catch (error) {
		console.error(`PATCH /api/datasets/${id} error:`, error)
		return Response.json({ error: error.message || 'Failed to update dataset.' }, { status: 500 })
	}
}
