'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (!activeId) {
				setLoading(false)
				return
			}

			try {
				const res = await fetch(`/api/datasets/${activeId}`)
				if (!res.ok) return

				const dataset = await res.json()
				const detectedTypes = detectColumnTypes(dataset.rows, dataset.columns)

				const numericResults = {}
				const textResults = {}

				for (const column of dataset.columns) {
					if (detectedTypes[column] === 'number') {
						numericResults[column] = getNumericColumnSummary(dataset.rows, column)
					} else if (detectedTypes[column] === 'text') {
						textResults[column] = getTextColumnSummary(dataset.rows, column)
					}
				}

				setRows(dataset.rows)
				setColumns(dataset.columns)
				setDatasetName(dataset.name || 'Unnamed dataset')
				setSummary(getDatasetSummary(dataset.rows, dataset.columns))
				setColumnTypes(detectedTypes)
				setNumericSummaries(numericResults)
				setTextSummaries(textResults)
			} catch {} finally {
				setLoading(false)
			}
		}

		load()
	}, [])

	if (loading) {
		return (
			<main style={{ padding: '24px' }}>
				<h1>Analysis</h1>
				<p>Loading...</p>
			</main>
		)
	}

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

			<div style={{ marginTop: '24px' }}>
				<h2>Further Analysis</h2>
				<ul>
					<li><Link href="/analysis/correlation">Correlation Analysis</Link></li>
					<li><Link href="/analysis/trend">Trend / Change Analysis</Link></li>
					<li><Link href="/analysis/outliers">Outlier Detection</Link></li>
				</ul>
			</div>
		</main>
	)
}
