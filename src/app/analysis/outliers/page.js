'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectColumnTypes, getOutlierAnalysis } from '@/lib/analysis'

export default function OutliersPage() {
	const [results, setResults] = useState({})
	const [datasetName, setDatasetName] = useState('')
	const [loading, setLoading] = useState(true)
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (!activeId) {
				setLoading(false)
				return
			}

			const res = await fetch(`/api/datasets/${activeId}`).catch(() => null)

			if (!res || !res.ok) {
				setLoading(false)
				return
			}

			const dataset = await res.json()
			const types = detectColumnTypes(dataset.rows, dataset.columns)
			setResults(getOutlierAnalysis(dataset.rows, dataset.columns, types))
			setDatasetName(dataset.name || 'Unnamed dataset')
			setLoaded(true)
			setLoading(false)
		}

		load()
	}, [])

	if (loading) {
		return <main ><h1>Outlier Detection</h1><p>Loading...</p></main>
	}

	if (!loaded) {
		return (
			<main >
				<h1>Outlier Detection</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main >
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
								<p><strong>Example outliers:</strong></p>
								<ul>
									{result.outliers.slice(0, 10).map((value, index) => (
										<li key={index}>{value}</li>
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
