'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectColumnTypes, getCorrelationAnalysis } from '@/lib/analysis'

function detectYearColumns(columns) {
	return columns.filter((col) => {
		const n = Number(col)
		return Number.isInteger(n) && n >= 1800 && n <= 2100
	})
}

export default function CorrelationPage() {
	const [results, setResults] = useState([])
	const [datasetName, setDatasetName] = useState('')
	const [wideFormat, setWideFormat] = useState(false)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (!activeId) { setLoading(false); return }

			try {
				const res = await fetch(`/api/datasets/${activeId}`)
				if (!res.ok) return

				const dataset = await res.json()
				const types = detectColumnTypes(dataset.rows, dataset.columns)
				const yearColumns = detectYearColumns(dataset.columns)

				if (yearColumns.length >= 2) {
					const yearColSet = new Set(yearColumns)
					const nonYearColumns = dataset.columns.filter((col) => !yearColSet.has(col))
					setResults(getCorrelationAnalysis(dataset.rows, nonYearColumns, types))
					setWideFormat(true)
				} else {
					setResults(getCorrelationAnalysis(dataset.rows, dataset.columns, types))
					setWideFormat(false)
				}

				setDatasetName(dataset.name || 'Unnamed dataset')
			} catch {} finally {
				setLoading(false)
			}
		}

		load()
	}, [])

	if (loading) return <main><h1>Correlation Analysis</h1><p>Loading...</p></main>

	if (!datasetName) {
		return (
			<main>
				<h1>Correlation Analysis</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main>
			<h1>Correlation Analysis</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>
			<p><Link href="/analysis">Back to Analysis</Link></p>

			{wideFormat && (
				<p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
					Date columns have been excluded. Correlations are shown for non-date numeric columns only.
				</p>
			)}

			<div style={{ marginTop: '24px' }}>
				{results.length === 0 && (
					<p>Not enough non-date numeric columns for correlation analysis.</p>
				)}

				{results.length > 0 && (
					<ul>
						{results.map((item, index) => (
							<li key={index}>
								<strong>{item.columnA}</strong> and <strong>{item.columnB}</strong>: {item.correlation.toFixed(4)}
							</li>
						))}
					</ul>
				)}
			</div>
		</main>
	)
}
