'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { detectColumnTypes, getOutlierAnalysis, parseDateMs } from '@/lib/analysis'


function isDateColumn(rows, column) {
	const sample = rows
		.map((r) => r[column])
		.filter((v) => v !== null && v !== undefined && v !== '')
		.slice(0, 20)

	if (sample.length === 0) return false
	return sample.filter((v) => parseDateMs(String(v)) !== null).length / sample.length >= 0.8
}

function computeMissingCounts(rows, columns) {
	const counts = {}
	for (const col of columns) {
		counts[col] = rows.filter((row) => {
			const val = row[col]
			return val === null || val === undefined || val === ''
		}).length
	}
	return counts
}

export default function CleanDataPage() {
	const params = useParams()
	const id = params.id

	const [dataset, setDataset] = useState(null)
	const [columnTypes, setColumnTypes] = useState({})
	const [missingCounts, setMissingCounts] = useState({})
	const [outlierResults, setOutlierResults] = useState({})
	const [selectedMissingColumns, setSelectedMissingColumns] = useState([])
	const [selectedOutlierColumns, setSelectedOutlierColumns] = useState([])

	const [filterColumn, setFilterColumn] = useState('')
	const [selectedFilterValues, setSelectedFilterValues] = useState([])
	const [filterSearch, setFilterSearch] = useState('')
	const [filterMin, setFilterMin] = useState('')
	const [filterMax, setFilterMax] = useState('')
	const [filterDateFrom, setFilterDateFrom] = useState('')
	const [filterDateTo, setFilterDateTo] = useState('')

	const [message, setMessage] = useState('')
	const [saving, setSaving] = useState(false)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function load() {
			try {
				const res = await fetch(`/api/datasets/${id}`)
				if (!res.ok) return
				const found = await res.json()
				const types = detectColumnTypes(found.rows, found.columns)
				setDataset(found)
				setColumnTypes(types)
				setMissingCounts(computeMissingCounts(found.rows, found.columns))
				setOutlierResults(getOutlierAnalysis(found.rows, found.columns, types))
			} catch {} finally {
				setLoading(false)
			}
		}

		load()
	}, [id])

	const availableFilterValues = useMemo(() => {
		if (!dataset || !filterColumn || columnTypes[filterColumn] !== 'text') return []

		const seen = new Set()
		for (let i = 0; i < dataset.rows.length; i++) {
			const val = dataset.rows[i][filterColumn]
			if (val !== null && val !== undefined && val !== '') {
				seen.add(String(val))
			}
		}
		return [...seen].sort()
	}, [dataset, filterColumn, columnTypes])

	const filteredAvailableValues = useMemo(() => {
		if (!filterSearch) return availableFilterValues.slice(0, 200)
		const lower = filterSearch.toLowerCase()
		return availableFilterValues.filter((v) => v.toLowerCase().includes(lower)).slice(0, 200)
	}, [availableFilterValues, filterSearch])

	const matchingRowCount = useMemo(() => {
		if (!dataset || !filterColumn) return 0

		const isNumeric = columnTypes[filterColumn] === 'number'
		const isDate = columnTypes[filterColumn] === 'text' && isDateColumn(dataset.rows, filterColumn)

		if (isDate) {
			if (filterDateFrom === '' && filterDateTo === '') return 0
			const fromMs = filterDateFrom ? new Date(filterDateFrom).getTime() : -Infinity
			const toMs = filterDateTo ? new Date(filterDateTo).setHours(23, 59, 59, 999) : Infinity
			return dataset.rows.filter((row) => {
				const ms = parseDateMs(String(row[filterColumn]))
				return ms !== null && ms >= fromMs && ms <= toMs
			}).length
		}

		if (isNumeric) {
			if (filterMin === '' && filterMax === '') return 0
			const min = filterMin !== '' ? Number(filterMin) : -Infinity
			const max = filterMax !== '' ? Number(filterMax) : Infinity
			return dataset.rows.filter((row) => {
				const val = row[filterColumn]
				return typeof val === 'number' && val >= min && val <= max
			}).length
		}

		if (selectedFilterValues.length === 0) return 0
		return dataset.rows.filter((row) =>
			selectedFilterValues.includes(String(row[filterColumn]))
		).length
	}, [dataset, filterColumn, columnTypes, selectedFilterValues, filterMin, filterMax, filterDateFrom, filterDateTo])

	function toggleFilterValue(value) {
		setSelectedFilterValues((current) =>
			current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
		)
	}

	function getFilteredRows() {
		if (!filterColumn) return null

		const isNumeric = columnTypes[filterColumn] === 'number'
		const isDate = columnTypes[filterColumn] === 'text' && isDateColumn(dataset.rows, filterColumn)

		if (isDate) {
			const fromMs = filterDateFrom ? new Date(filterDateFrom).getTime() : -Infinity
			const toMs = filterDateTo ? new Date(filterDateTo).setHours(23, 59, 59, 999) : Infinity
			return dataset.rows.filter((row) => {
				const ms = parseDateMs(String(row[filterColumn]))
				return ms !== null && ms >= fromMs && ms <= toMs
			})
		}

		if (isNumeric) {
			const min = filterMin !== '' ? Number(filterMin) : -Infinity
			const max = filterMax !== '' ? Number(filterMax) : Infinity
			return dataset.rows.filter((row) => {
				const val = row[filterColumn]
				return typeof val === 'number' && val >= min && val <= max
			})
		}

		return dataset.rows.filter((row) =>
			selectedFilterValues.includes(String(row[filterColumn]))
		)
	}

	function toggleMissingColumn(col) {
		setSelectedMissingColumns((current) =>
			current.includes(col) ? current.filter((c) => c !== col) : [...current, col]
		)
	}

	function toggleOutlierColumn(col) {
		setSelectedOutlierColumns((current) =>
			current.includes(col) ? current.filter((c) => c !== col) : [...current, col]
		)
	}

	async function applyClean(newRows, msg) {
		setSaving(true)
		try {
			const res = await fetch(`/api/datasets/${dataset.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows: newRows })
			})

			if (!res.ok) {
				setMessage('Failed to save changes.')
				return
			}

			const updatedMetadata = await res.json()
			const updated = { ...updatedMetadata, rows: newRows }

			const newTypes = detectColumnTypes(newRows, updated.columns)
			setDataset(updated)
			setColumnTypes(newTypes)
			setMissingCounts(computeMissingCounts(newRows, updated.columns))
			setOutlierResults(getOutlierAnalysis(newRows, updated.columns, newTypes))
			setSelectedMissingColumns([])
			setSelectedOutlierColumns([])
			setFilterColumn('')
			setSelectedFilterValues([])
			setFilterSearch('')
			setFilterMin('')
			setFilterMax('')
			setFilterDateFrom('')
			setFilterDateTo('')
			setMessage(msg)
		} finally {
			setSaving(false)
		}
	}

	function removeMatchingRows() {
		const matching = new Set(getFilteredRows())
		const newRows = dataset.rows.filter((row) => !matching.has(row))
		applyClean(newRows, `Removed ${dataset.rows.length - newRows.length} matching rows. Dataset now has ${newRows.length} rows.`)
	}

	function keepOnlyMatchingRows() {
		const newRows = getFilteredRows()
		applyClean(newRows, `Kept ${newRows.length} matching rows, removed ${dataset.rows.length - newRows.length}. Dataset now has ${newRows.length} rows.`)
	}

	function removeMissingValues() {
		const newRows = dataset.rows.filter((row) => {
			for (const col of selectedMissingColumns) {
				const val = row[col]
				if (val === null || val === undefined || val === '') return false
			}
			return true
		})
		applyClean(newRows, `Removed ${dataset.rows.length - newRows.length} rows with missing values. Dataset now has ${newRows.length} rows.`)
	}

	function removeOutliers() {
		const bounds = {}
		for (const col of selectedOutlierColumns) {
			bounds[col] = { lower: outlierResults[col].lowerBound, upper: outlierResults[col].upperBound }
		}

		const newRows = dataset.rows.filter((row) => {
			for (const col of selectedOutlierColumns) {
				const val = row[col]
				if (typeof val === 'number' && (val < bounds[col].lower || val > bounds[col].upper)) {
					return false
				}
			}
			return true
		})
		applyClean(newRows, `Removed ${dataset.rows.length - newRows.length} outlier rows. Dataset now has ${newRows.length} rows.`)
	}

	if (loading) {
		return (
			<main style={{ padding: '24px' }}>
				<h1>Clean Data</h1>
				<p>Loading...</p>
			</main>
		)
	}

	if (!dataset) {
		return (
			<main style={{ padding: '24px' }}>
				<h1>Clean Data</h1>
				<p>Dataset not found. It may have been deleted or the page was refreshed.</p>
				<p><Link href="/datasets">← Back to Datasets</Link></p>
			</main>
		)
	}

	const numericColumns = dataset.columns.filter((col) => columnTypes[col] === 'number')
	const filterIsNumeric = filterColumn && columnTypes[filterColumn] === 'number'
	const filterIsText = filterColumn && columnTypes[filterColumn] === 'text'
	const filterIsDate = filterIsText && isDateColumn(dataset.rows, filterColumn)
	const filterReady = filterColumn && (
		filterIsDate ? (filterDateFrom !== '' || filterDateTo !== '') :
		filterIsNumeric ? (filterMin !== '' || filterMax !== '') :
		selectedFilterValues.length > 0
	)

	return (
		<main style={{ padding: '24px' }}>
			<h1>Clean Data</h1>
			<p><strong>Dataset:</strong> {dataset.name} — {dataset.rowCount} rows</p>
			<p><Link href="/datasets">← Back to Datasets</Link></p>

			{message && <p style={{ marginTop: '12px' }}>{message}</p>}
			{saving && <p>Saving changes...</p>}

			<div style={{ marginTop: '24px' }}>
				<h2>Filter Rows</h2>
				<p>Select a column and define a filter, then remove matching rows or keep only matching rows.</p>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="filterColumn"><strong>Filter column: </strong></label>
					<select
						id="filterColumn"
						value={filterColumn}
						onChange={(e) => {
							setFilterColumn(e.target.value)
							setSelectedFilterValues([])
							setFilterSearch('')
							setFilterMin('')
							setFilterMax('')
							setFilterDateFrom('')
							setFilterDateTo('')
						}}
					>
						<option value="">Select a column</option>
						{dataset.columns.map((col) => (
							<option key={col} value={col}>{col}</option>
						))}
					</select>
				</div>

				{filterIsDate && (
					<div style={{ marginBottom: '16px' }}>
						<label>
							<strong>From: </strong>
							<input
								type="date"
								value={filterDateFrom}
								onChange={(e) => setFilterDateFrom(e.target.value)}
								style={{ marginLeft: '4px' }}
							/>
						</label>

						<label style={{ marginLeft: '16px' }}>
							<strong>To: </strong>
							<input
								type="date"
								value={filterDateTo}
								onChange={(e) => setFilterDateTo(e.target.value)}
								style={{ marginLeft: '4px' }}
							/>
						</label>

						<p style={{ marginTop: '6px' }}>{matchingRowCount} rows matched</p>
					</div>
				)}

				{filterIsText && !filterIsDate && (
					<div style={{ marginBottom: '16px' }}>
						<input
							type="text"
							value={filterSearch}
							onChange={(e) => setFilterSearch(e.target.value)}
							placeholder="Search values..."
							style={{ marginBottom: '8px', display: 'block' }}
						/>

						<div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
							<button type="button" onClick={() => setSelectedFilterValues(filteredAvailableValues)}>
								Select all
							</button>
							<button type="button" onClick={() => setSelectedFilterValues([])}>
								Clear all
							</button>
						</div>

						<div style={{ maxHeight: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '8px' }}>
							{filteredAvailableValues.map((value) => (
								<label key={value} style={{ display: 'block', marginBottom: '4px' }}>
									<input
										type="checkbox"
										checked={selectedFilterValues.includes(value)}
										onChange={() => toggleFilterValue(value)}
									/>
									{' '}{value}
								</label>
							))}
						</div>

						<p style={{ marginTop: '6px' }}>{selectedFilterValues.length} selected — {matchingRowCount} rows matched</p>
					</div>
				)}

				{filterIsNumeric && (
					<div style={{ marginBottom: '16px' }}>
						<label>
							<strong>Min: </strong>
							<input
								type="number"
								value={filterMin}
								onChange={(e) => setFilterMin(e.target.value)}
								placeholder="No minimum"
								style={{ marginLeft: '4px', width: '120px' }}
							/>
						</label>

						<label style={{ marginLeft: '16px' }}>
							<strong>Max: </strong>
							<input
								type="number"
								value={filterMax}
								onChange={(e) => setFilterMax(e.target.value)}
								placeholder="No maximum"
								style={{ marginLeft: '4px', width: '120px' }}
							/>
						</label>

						<p style={{ marginTop: '6px' }}>{matchingRowCount} rows matched</p>
					</div>
				)}

				{filterColumn && (
					<div style={{ display: 'flex', gap: '8px' }}>
						<button
							type="button"
							onClick={removeMatchingRows}
							disabled={!filterReady || saving}
						>
							Remove matching rows
						</button>

						<button
							type="button"
							onClick={keepOnlyMatchingRows}
							disabled={!filterReady || saving}
						>
							Keep only matching rows
						</button>
					</div>
				)}
			</div>

			<div style={{ marginTop: '32px' }}>
				<h2>Missing Values</h2>
				<p>Tick the columns you want to check. Any row that has a missing value in a ticked column will be removed.</p>

				{dataset.columns.map((col) => (
					<div key={col} style={{ marginBottom: '8px' }}>
						<label>
							<input
								type="checkbox"
								checked={selectedMissingColumns.includes(col)}
								onChange={() => toggleMissingColumn(col)}
								disabled={missingCounts[col] === 0}
							/>
							{' '}<strong>{col}</strong> — {missingCounts[col] === 0 ? 'no missing values' : `${missingCounts[col]} missing`}
						</label>
					</div>
				))}

				<button
					type="button"
					onClick={removeMissingValues}
					disabled={selectedMissingColumns.length === 0 || saving}
					style={{ marginTop: '12px' }}
				>
					Remove rows with missing values
				</button>
			</div>

			<div style={{ marginTop: '32px' }}>
				<h2>Outlier Removal</h2>
				<p>Outliers are identified using the IQR method. Tick the columns you want to check. Any row with an outlier value in a ticked column will be removed.</p>

				{numericColumns.length === 0 && <p>No numeric columns found in this dataset.</p>}

				{numericColumns.map((col) => {
					const result = outlierResults[col]
					if (!result) return null
					return (
						<div key={col} style={{ marginBottom: '8px' }}>
							<label>
								<input
									type="checkbox"
									checked={selectedOutlierColumns.includes(col)}
									onChange={() => toggleOutlierColumn(col)}
									disabled={result.outliers.length === 0}
								/>
								{' '}<strong>{col}</strong> — {result.outliers.length === 0 ? 'no outliers detected' : `${result.outliers.length} outlier${result.outliers.length !== 1 ? 's' : ''}`} (bounds: {result.lowerBound.toFixed(2)} to {result.upperBound.toFixed(2)})
							</label>
						</div>
					)
				})}

				<button
					type="button"
					onClick={removeOutliers}
					disabled={selectedOutlierColumns.length === 0 || saving}
					style={{ marginTop: '12px' }}
				>
					Remove outlier rows
				</button>
			</div>
		</main>
	)
}
