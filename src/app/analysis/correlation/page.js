'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectColumnTypes, getCorrelationAnalysis } from '@/lib/analysis'

export default function CorrelationPage() {
	const [results, setResults] = useState([])
	const [datasetName, setDatasetName] = useState('')
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
				setResults(getCorrelationAnalysis(dataset.rows, dataset.columns, types))
				setDatasetName(dataset.name || 'Unnamed dataset')
			} catch {}  finally {
				setLoading(false)
			}
		}

		load()
	}, [])

	if (loading) {
		return <main style={{ padding: '24px' }}><h1>Correlation Analysis</h1><p>Loading...</p></main>
	}

	if (!datasetName) {
		return (
			<main style={{ padding: '24px' }}>
				<h1>Correlation Analysis</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main style={{ padding: '24px' }}>
			<h1>Correlation Analysis</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>
			<p><Link href="/analysis">← Back to Analysis</Link></p>

			<div style={{ marginTop: '24px' }}>
				{results.length === 0 && <p>Not enough numeric columns for correlation analysis.</p>}

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
