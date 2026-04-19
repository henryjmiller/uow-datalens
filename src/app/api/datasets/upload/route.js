import Papa from 'papaparse'

export async function POST(request) {
	try {
		const formData = await request.formData()
		const file = formData.get('file')

		if (!file) {
			return Response.json(
				{ error: 'No file was uploaded.' },
				{ status: 400 }
			)
		}

		if (!file.name.toLowerCase().endsWith('.csv')) {
			return Response.json(
				{ error: 'Only CSV files are allowed.' },
				{ status: 400 }
			)
		}

		const fileText = await file.text()

		const result = Papa.parse(fileText, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: true
		})

		if (result.errors && result.errors.length > 0) {
			return Response.json(
				{
					error: 'CSV parsing failed.',
					details: result.errors
				},
				{ status: 400 }
			)
		}

		return Response.json({
			message: 'CSV uploaded and parsed successfully.',
			columns: result.meta.fields || [],
			rowCount: result.data.length,
			preview: result.data.slice(0, 5),
			rows: result.data
		})
	} catch (error) {
		console.error(error)

		return Response.json(
			{ error: 'Server error while processing CSV file.' },
			{ status: 500 }
		)
	}
}