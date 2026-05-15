'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectColumnTypes, getTrendAnalysis } from '@/lib/analysis'

export default function TrendPage() {
	const [results, setResults] = useState([])
	const [datasetName, setDatasetName] = useState('')
	const [loading, setLoading] = useState(true)
	const [notFound, setNotFound] = useState(false)

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')

			if (!activeId) {
				setNotFound(true)
				setLoading(false)
				return
			}

			try {
				const res = await fetch(`/api/datasets/${activeId}`)

				if (!res.ok) {
					setNotFound(true)
					return
				}

				const dataset = await res.json()
				const types = detectColumnTypes(dataset.rows, dataset.columns)
				setResults(getTrendAnalysis(dataset.rows, dataset.columns, types))
				setDatasetName(dataset.name || 'Unnamed dataset')
			} catch {
				setNotFound(true)
			} finally {
				setLoading(false)
			}
		}

		load()
	}, [])

	if (loading) {
		return <main style={{ padding: '24px' }}><h1>Trend / Change Analysis</h1><p>Loading...</p></main>
	}

	if (notFound) {
		return (
			<main style={{ padding: '24px' }}>
				<h1>Trend / Change Analysis</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main style={{ padding: '24px' }}>
			<h1>Trend / Change Analysis</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>
			<p><Link href="/analysis">← Back to Analysis</Link></p>

			<div style={{ marginTop: '24px' }}>
				{results.length === 0 && <p>No trend analysis could be generated.</p>}

				{results.length > 0 && (
					<div>
						{results.map((item) => (
							<div key={item.column} style={{ marginBottom: '16px' }}>
								<h3>{item.column}</h3>
								<ul>
									<li><strong>First value:</strong> {item.firstValue}</li>
									<li><strong>Last value:</strong> {item.lastValue}</li>
									<li><strong>Absolute change:</strong> {item.absoluteChange.toFixed(2)}</li>
									<li><strong>Percentage change:</strong> {item.percentageChange.toFixed(2)}%</li>
								</ul>
							</div>
						))}
					</div>
				)}
			</div>
		</main>
	)
}
