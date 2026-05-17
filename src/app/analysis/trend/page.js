'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectColumnTypes, getTrendAnalysis, getWideFormatTrendAnalysis } from '@/lib/analysis'

function detectYearColumns(columns) {
	return columns
		.filter((col) => { const n = Number(col); return Number.isInteger(n) && n >= 1800 && n <= 2100 })
		.sort((a, b) => Number(a) - Number(b))
}

function detectEntityColumn(rows, columns, types) {
	const textColumns = columns.filter((col) => types[col] === 'text')
	if (textColumns.length === 0) return null
	return textColumns.reduce((best, col) => {
		const ua = new Set(rows.map((r) => r[col])).size
		const ub = new Set(rows.map((r) => r[best])).size
		return ua > ub ? col : best
	})
}

export default function TrendPage() {
	const [results, setResults] = useState([])
	const [datasetName, setDatasetName] = useState('')
	const [wideFormat, setWideFormat] = useState(false)
	const [yearRange, setYearRange] = useState(null)
	const [loading, setLoading] = useState(true)
	const [notFound, setNotFound] = useState(false)

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (!activeId) { setNotFound(true); setLoading(false); return }

			try {
				const res = await fetch(`/api/datasets/${activeId}`)
				if (!res.ok) { setNotFound(true); return }

				const dataset = await res.json()
				const types = detectColumnTypes(dataset.rows, dataset.columns)
				const yearColumns = detectYearColumns(dataset.columns)

				if (yearColumns.length >= 2) {
					const entityColumn = detectEntityColumn(dataset.rows, dataset.columns, types)
					setResults(getWideFormatTrendAnalysis(dataset.rows, yearColumns, entityColumn))
					setWideFormat(true)
					setYearRange({ first: yearColumns[0], last: yearColumns[yearColumns.length - 1] })
				} else {
					setResults(getTrendAnalysis(dataset.rows, dataset.columns, types))
					setWideFormat(false)
				}

				setDatasetName(dataset.name || 'Unnamed dataset')
			} catch {
				setNotFound(true)
			} finally {
				setLoading(false)
			}
		}

		load()
	}, [])

	if (loading) return <main><h1>Trend / Change Analysis</h1><p>Loading...</p></main>

	if (notFound) {
		return (
			<main>
				<h1>Trend / Change Analysis</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main>
			<h1>Trend / Change Analysis</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>
			<p><Link href="/analysis">Back to Analysis</Link></p>

			<div style={{ marginTop: '24px' }}>
				{results.length === 0 && <p>No trend analysis could be generated.</p>}

				{results.length > 0 && wideFormat && (
					<>
						<p>Showing all entities by absolute change from <strong>{yearRange.first}</strong> to <strong>{yearRange.last}</strong>.</p>
						{results.map((item, index) => (
							<div key={index} style={{ marginBottom: '16px' }}>
								<h3>{item.entity}</h3>
								<ul>
									<li><strong>Value in {yearRange.first}:</strong> {item.firstValue.toLocaleString()}</li>
									<li><strong>Value in {yearRange.last}:</strong> {item.lastValue.toLocaleString()}</li>
									<li><strong>Absolute change:</strong> {item.absoluteChange.toLocaleString()}</li>
									<li><strong>Percentage change:</strong> {item.percentageChange.toFixed(2)}%</li>
								</ul>
							</div>
						))}
					</>
				)}

				{results.length > 0 && !wideFormat && (
					results.map((item) => (
						<div key={item.column} style={{ marginBottom: '16px' }}>
							<h3>{item.column}</h3>
							<ul>
								<li><strong>First value:</strong> {item.firstValue}</li>
								<li><strong>Last value:</strong> {item.lastValue}</li>
								<li><strong>Absolute change:</strong> {item.absoluteChange.toFixed(2)}</li>
								<li><strong>Percentage change:</strong> {item.percentageChange.toFixed(2)}%</li>
							</ul>
						</div>
					))
				)}
			</div>
		</main>
	)
}
