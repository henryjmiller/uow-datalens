import { listDatasets, saveDataset } from '@/lib/cosmos'

export async function GET() {
	try {
		const datasets = await listDatasets()
		return Response.json(datasets)
	} catch (error) {
		console.error('GET /api/datasets error:', error)
		return Response.json({ error: error.message || 'Failed to load datasets.' }, { status: 500 })
	}
}

export async function POST(request) {
	try {
		const dataset = await request.json()
		const metadata = await saveDataset(dataset)
		return Response.json(metadata)
	} catch (error) {
		console.error('POST /api/datasets error:', error)
		return Response.json({ error: error.message || 'Failed to save dataset.' }, { status: 500 })
	}
}
