'use client'

import { useEffect, useState } from 'react'
import {
	detectColumnTypes,
	getDatasetSummary,
	getNumericColumnSummary,
	getTextColumnSummary
} from '@/lib/analysis'

export default function AnalysisPage() {
	const [rows, setRows] = useState([])
	const [columns, setColumns] = useState([])
	const [datasetName, setDatasetName] = useState('')
	const [summary, setSummary] = useState(null)
	const [columnTypes, setColumnTypes] = useState({})
	const [numericSummaries, setNumericSummaries] = useState({})
	const [textSummaries, setTextSummaries] = useState({})

	useEffect(() => {
		const savedRows = localStorage.getItem('uploadedDataset')
		const savedColumns = localStorage.getItem('uploadedDatasetColumns')
		const savedName = localStorage.getItem('uploadedDatasetName')

		if (!savedRows || !savedColumns) {
			return
		}

		const parsedRows = JSON.parse(savedRows)
		const parsedColumns = JSON.parse(savedColumns)

		setRows(parsedRows)
		setColumns(parsedColumns)
		setDatasetName(savedName || 'Unnamed dataset')

		const datasetSummary = getDatasetSummary(parsedRows, parsedColumns)
		const detectedTypes = detectColumnTypes(parsedRows, parsedColumns)

		const numericResults = {}
		const textResults = {}

		for (const column of parsedColumns) {
			if (detectedTypes[column] === 'number') {
				numericResults[column] = getNumericColumnSummary(parsedRows, column)
			} else if (detectedTypes[column] === 'text') {
				textResults[column] = getTextColumnSummary(parsedRows, column)
			}
		}

		setSummary(datasetSummary)
		setColumnTypes(detectedTypes)
		setNumericSummaries(numericResults)
		setTextSummaries(textResults)
	}, [])

	if (rows.length === 0) {
		return (
			<main style={{ padding: '24px' }}>
				<h1>Analysis</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main style={{ padding: '24px' }}>
			<h1>Analysis</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>

			{summary && (
				<div style={{ marginTop: '24px' }}>
					<h2>Dataset Summary</h2>
					<ul>
						<li><strong>Total rows:</strong> {summary.totalRows}</li>
						<li><strong>Total columns:</strong> {summary.totalColumns}</li>
					</ul>
				</div>
			)}

			<div style={{ marginTop: '24px' }}>
				<h2>Column Types</h2>
				<ul>
					{columns.map((column) => (
						<li key={column}>
							<strong>{column}:</strong> {columnTypes[column]}
						</li>
					))}
				</ul>
			</div>

			<div style={{ marginTop: '24px' }}>
				<h2>Numeric Column Analysis</h2>
				{Object.keys(numericSummaries).length === 0 && <p>No numeric columns found.</p>}

				{Object.entries(numericSummaries).map(([column, stats]) => (
					<div key={column} style={{ marginBottom: '16px' }}>
						<h3>{column}</h3>
						<ul>
							<li><strong>Count:</strong> {stats.count}</li>
							<li><strong>Minimum:</strong> {stats.min}</li>
							<li><strong>Maximum:</strong> {stats.max}</li>
							<li><strong>Average:</strong> {stats.average.toFixed(2)}</li>
						</ul>
					</div>
				))}
			</div>

			<div style={{ marginTop: '24px' }}>
				<h2>Text Column Analysis</h2>
				{Object.keys(textSummaries).length === 0 && <p>No text columns found.</p>}

				{Object.entries(textSummaries).map(([column, stats]) => (
					<div key={column} style={{ marginBottom: '16px' }}>
						<h3>{column}</h3>
						<p><strong>Non-empty values:</strong> {stats.count}</p>
						<p><strong>Top values:</strong></p>
						<ul>
							{stats.topValues.map(([value, count]) => (
								<li key={value}>
									{value} ({count})
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</main>
	)
}