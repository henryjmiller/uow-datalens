'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectColumnTypes, getOutlierAnalysis } from '@/lib/analysis'

function detectEntityColumn(rows, columns, types) {
	const textColumns = columns.filter((col) => types[col] === 'text')
	if (textColumns.length === 0) return null
	return textColumns.reduce((best, col) => {
		const ua = new Set(rows.map((r) => r[col])).size
		const ub = new Set(rows.map((r) => r[best])).size
		return ua > ub ? col : best
	})
}

export default function OutliersPage() {
	const [results, setResults] = useState({})
	const [datasetName, setDatasetName] = useState('')
	const [loading, setLoading] = useState(true)
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (!activeId) { setLoading(false); return }

			const res = await fetch(`/api/datasets/${activeId}`).catch(() => null)
			if (!res || !res.ok) { setLoading(false); return }

			const dataset = await res.json()
			const types = detectColumnTypes(dataset.rows, dataset.columns)
			const entityColumn = detectEntityColumn(dataset.rows, dataset.columns, types)
			setResults(getOutlierAnalysis(dataset.rows, dataset.columns, types, entityColumn))
			setDatasetName(dataset.name || 'Unnamed dataset')
			setLoaded(true)
			setLoading(false)
		}

		load()
	}, [])

	if (loading) return <main><h1>Outlier Detection</h1><p>Loading...</p></main>

	if (!loaded) {
		return (
			<main>
				<h1>Outlier Detection</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main>
			<h1>Outlier Detection</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>
			<p><Link href="/analysis">Back to Analysis</Link></p>

			<div style={{ marginTop: '24px' }}>
				{Object.keys(results).length === 0 && <p>No outlier analysis available.</p>}

				{Object.entries(results).map(([column, result]) => (
					<div key={column} style={{ marginBottom: '16px' }}>
						<h3>{column}</h3>
						<ul>
							<li><strong>Lower bound:</strong> {result.lowerBound.toFixed(2)}</li>
							<li><strong>Upper bound:</strong> {result.upperBound.toFixed(2)}</li>
							<li><strong>Outliers found:</strong> {result.outliers.length}</li>
						</ul>

						{result.outliers.length > 0 && (
							<div>
								<p><strong>Outliers:</strong></p>
								<ul>
									{result.outliers.map(({ value, entity }, index) => (
										<li key={index}>
											{entity ? <><strong>{entity}:</strong> </> : null}
											{value.toLocaleString()}
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				))}
			</div>
		</main>
	)
}
