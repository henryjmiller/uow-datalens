export function detectColumnTypes(rows, columns) {
	const columnTypes = {}

	for (const column of columns) {
		const values = rows
			.map((row) => row[column])
			.filter((value) => value !== null && value !== undefined && value !== '')

		if (values.length === 0) {
			columnTypes[column] = 'empty'
			continue
		}

		const numericCount = values.filter((value) => typeof value === 'number' && !Number.isNaN(value)).length

		if (numericCount === values.length) {
			columnTypes[column] = 'number'
		} else {
			columnTypes[column] = 'text'
		}
	}

	return columnTypes
}

export function getDatasetSummary(rows, columns) {
	return {
		totalRows: rows.length,
		totalColumns: columns.length,
		columnNames: columns
	}
}

export function getNumericColumnSummary(rows, column) {
	const values = rows
		.map((row) => row[column])
		.filter((value) => typeof value === 'number' && !Number.isNaN(value))

	if (values.length === 0) {
		return null
	}

	const total = values.reduce((sum, value) => sum + value, 0)
	const min = Math.min(...values)
	const max = Math.max(...values)
	const average = total / values.length

	return {
		count: values.length,
		min,
		max,
		average
	}
}

export function getTextColumnSummary(rows, column) {
	const values = rows
		.map((row) => row[column])
		.filter((value) => typeof value === 'string' && value.trim() !== '')

	const counts = {}

	for (const value of values) {
		counts[value] = (counts[value] || 0) + 1
	}

	const sorted = Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)

	return {
		count: values.length,
		topValues: sorted
	}
}

