export function parseDateMs(value) {
	if (typeof value !== 'string') return null

	const ddmmyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
	if (ddmmyyyy) {
		return new Date(
			parseInt(ddmmyyyy[3], 10),
			parseInt(ddmmyyyy[2], 10) - 1,
			parseInt(ddmmyyyy[1], 10)
		).getTime()
	}

	const yyyymmdd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (yyyymmdd) {
		return new Date(
			parseInt(yyyymmdd[1], 10),
			parseInt(yyyymmdd[2], 10) - 1,
			parseInt(yyyymmdd[3], 10)
		).getTime()
	}

	return null
}

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

function getNumericValues(rows, column) {
	return rows
		.map((row) => row[column])
		.filter((value) => typeof value === 'number' && !Number.isNaN(value))
}

function getMean(values) {
	if (values.length === 0) {
		return 0
	}

	const total = values.reduce((sum, value) => sum + value, 0)
	return total / values.length
}

function getCorrelation(valuesA, valuesB) {
	if (valuesA.length !== valuesB.length || valuesA.length < 2) {
		return null
	}

	const meanA = getMean(valuesA)
	const meanB = getMean(valuesB)

	let numerator = 0
	let denominatorA = 0
	let denominatorB = 0

	for (let i = 0; i < valuesA.length; i++) {
		const diffA = valuesA[i] - meanA
		const diffB = valuesB[i] - meanB

		numerator += diffA * diffB
		denominatorA += diffA * diffA
		denominatorB += diffB * diffB
	}

	if (denominatorA === 0 || denominatorB === 0) {
		return null
	}

	return numerator / Math.sqrt(denominatorA * denominatorB)
}

export function getCorrelationAnalysis(rows, columns, detectedTypes) {
	const numericColumns = columns.filter((column) => detectedTypes[column] === 'number')
	const results = []

	for (let i = 0; i < numericColumns.length; i++) {
		for (let j = i + 1; j < numericColumns.length; j++) {
			const columnA = numericColumns[i]
			const columnB = numericColumns[j]

			const pairedValues = rows
				.map((row) => ({
					valueA: row[columnA],
					valueB: row[columnB]
				}))
				.filter(
					(item) =>
						typeof item.valueA === 'number' &&
						!Number.isNaN(item.valueA) &&
						typeof item.valueB === 'number' &&
						!Number.isNaN(item.valueB)
				)

			const valuesA = pairedValues.map((item) => item.valueA)
			const valuesB = pairedValues.map((item) => item.valueB)

			const correlation = getCorrelation(valuesA, valuesB)

			if (correlation !== null) {
				results.push({
					columnA,
					columnB,
					correlation
				})
			}
		}
	}

	results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))

	return results.slice(0, 10)
}

export function getTrendAnalysis(rows, columns, detectedTypes) {
	const numericColumns = columns.filter((column) => detectedTypes[column] === 'number')
	const results = []

	for (const column of numericColumns) {
		const values = getNumericValues(rows, column)

		if (values.length < 2) {
			continue
		}

		const firstValue = values[0]
		const lastValue = values[values.length - 1]
		const absoluteChange = lastValue - firstValue

		let percentageChange = 0

		if (firstValue !== 0) {
			percentageChange = (absoluteChange / firstValue) * 100
		}

		results.push({
			column,
			firstValue,
			lastValue,
			absoluteChange,
			percentageChange
		})
	}

	results.sort((a, b) => Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange))

	return results.slice(0, 10)
}

function getQuartile(sortedValues, quartile) {
	const position = (sortedValues.length - 1) * quartile
	const base = Math.floor(position)
	const remainder = position - base

	if (sortedValues[base + 1] !== undefined) {
		return sortedValues[base] + remainder * (sortedValues[base + 1] - sortedValues[base])
	}

	return sortedValues[base]
}

export function getOutlierAnalysis(rows, columns, detectedTypes) {
	const numericColumns = columns.filter((column) => detectedTypes[column] === 'number')
	const results = {}

	for (const column of numericColumns) {
		const values = getNumericValues(rows, column).sort((a, b) => a - b)

		if (values.length < 4) {
			continue
		}

		const q1 = getQuartile(values, 0.25)
		const q3 = getQuartile(values, 0.75)
		const iqr = q3 - q1
		const lowerBound = q1 - 1.5 * iqr
		const upperBound = q3 + 1.5 * iqr

		const outliers = values.filter((value) => value < lowerBound || value > upperBound)

		results[column] = {
			q1,
			q3,
			iqr,
			lowerBound,
			upperBound,
			outliers
		}
	}

	return results
}