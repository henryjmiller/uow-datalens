'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as ChartJS from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { detectColumnTypes } from '@/lib/analysis'

ChartJS.Chart.register(...ChartJS.registerables)

function getColour(index, alpha) {
	const hue = (index * 57) % 360
	return `hsla(${hue}, 70%, 55%, ${alpha})`
}

function getBorderColour(index) {
	const hue = (index * 57) % 360
	return `hsl(${hue}, 70%, 40%)`
}

function getColumnSums(rows, selectedValueColumns) {
	const results = []

	for (let i = 0; i < selectedValueColumns.length; i++) {
		const column = selectedValueColumns[i]
		let total = 0

		for (let j = 0; j < rows.length; j++) {
			const value = rows[j][column]

			if (typeof value === 'number' && !Number.isNaN(value)) {
				total += value
			}
		}

		results.push({
			label: column,
			value: total
		})
	}

	return results
}

function sortItems(items, direction) {
	const sorted = [...items]

	sorted.sort((a, b) => {
		if (typeof a.value === 'number' && typeof b.value === 'number') {
			return a.value - b.value
		}

		return String(a.label).localeCompare(String(b.label))
	})

	if (direction === 'desc') {
		sorted.reverse()
	}

	return sorted
}

function sortRows(rows, labelColumn, sortColumn, direction) {
	const sorted = [...rows]

	sorted.sort((a, b) => {
		let valueA
		let valueB

		if (sortColumn === 'label') {
			valueA = a[labelColumn]
			valueB = b[labelColumn]
		} else {
			valueA = a[sortColumn]
			valueB = b[sortColumn]
		}

		if (typeof valueA === 'number' && typeof valueB === 'number') {
			return valueA - valueB
		}

		return String(valueA ?? '').localeCompare(String(valueB ?? ''))
	})

	if (direction === 'desc') {
		sorted.reverse()
	}

	return sorted
}

function buildAggregatedChartData(items, chartType, colourMode) {
	const labels = items.map((item) => item.label)
	const values = items.map((item) => item.value)

	if (chartType === 'pie') {
		return {
			labels: labels,
			datasets: [
				{
					label: 'Values',
					data: values,
					backgroundColor: items.map((item, index) => getColour(index, 0.75)),
					borderColor: items.map((item, index) => getBorderColour(index)),
					borderWidth: 1
				}
			]
		}
	}

	if (colourMode === 'row') {
		return {
			labels: labels,
			datasets: [
				{
					label: 'Values',
					data: values,
					backgroundColor: items.map((item, index) => getColour(index, 0.65)),
					borderColor: items.map((item, index) => getBorderColour(index)),
					borderWidth: 2
				}
			]
		}
	}

	return {
		labels: labels,
		datasets: [
			{
				label: 'Values',
				data: values,
				backgroundColor: getColour(0, 0.65),
				borderColor: getBorderColour(0),
				borderWidth: 2
			}
		]
	}
}

function buildRawChartData(rows, chartType, labelColumn, selectedValueColumns, colourMode) {
	const labels = rows.map((row) => String(row[labelColumn] ?? ''))

	if (chartType === 'pie') {
		const valueColumn = selectedValueColumns[0]

		return {
			labels: labels,
			datasets: [
				{
					label: valueColumn,
					data: rows.map((row) => {
						const value = row[valueColumn]
						return typeof value === 'number' ? value : 0
					}),
					backgroundColor: rows.map((row, index) => getColour(index, 0.75)),
					borderColor: rows.map((row, index) => getBorderColour(index)),
					borderWidth: 1
				}
			]
		}
	}

	if (colourMode === 'row' && selectedValueColumns.length === 1) {
		const valueColumn = selectedValueColumns[0]

		return {
			labels: labels,
			datasets: [
				{
					label: valueColumn,
					data: rows.map((row) => {
						const value = row[valueColumn]
						return typeof value === 'number' ? value : 0
					}),
					backgroundColor: rows.map((row, index) => getColour(index, 0.65)),
					borderColor: rows.map((row, index) => getBorderColour(index)),
					borderWidth: 2
				}
			]
		}
	}

	return {
		labels: labels,
		datasets: selectedValueColumns.map((column, index) => {
			return {
				label: column,
				data: rows.map((row) => {
					const value = row[column]
					return typeof value === 'number' ? value : 0
				}),
				backgroundColor: getColour(index, 0.65),
				borderColor: getBorderColour(index),
				borderWidth: 2
			}
		})
	}
}

function buildChartOptions(chartType, yAxisLabel) {
	if (chartType === 'pie') {
		return {
			responsive: true,
			plugins: {
				legend: {
					display: true
				}
			}
		}
	}

	return {
		responsive: true,
		plugins: {
			legend: {
				display: true
			}
		},
		scales: {
			y: {
				beginAtZero: true,
				title: {
					display: Boolean(yAxisLabel),
					text: yAxisLabel
				}
			}
		}
	}
}

export default function VisualisationsPage() {
	const chartRef = useRef(null)

	const [rows, setRows] = useState([])
	const [columns, setColumns] = useState([])
	const [datasetName, setDatasetName] = useState('')

	const [chartType, setChartType] = useState('bar')
	const [labelColumn, setLabelColumn] = useState('')
	const [selectedValueColumns, setSelectedValueColumns] = useState([])
	const [yAxisLabel, setYAxisLabel] = useState('')
	const [sortColumn, setSortColumn] = useState('')
	const [sortDirection, setSortDirection] = useState('asc')
	const [aggregateValues, setAggregateValues] = useState(false)
	const [colourMode, setColourMode] = useState('column')
	const [savedMessage, setSavedMessage] = useState('')

	useEffect(() => {
		const savedRows = localStorage.getItem('uploadedDataset')
		const savedColumns = localStorage.getItem('uploadedDatasetColumns')
		const savedName = localStorage.getItem('uploadedDatasetName')

		if (!savedRows || !savedColumns) {
			return
		}

		setRows(JSON.parse(savedRows))
		setColumns(JSON.parse(savedColumns))
		setDatasetName(savedName || 'Unnamed dataset')
	}, [])

	const columnTypes = useMemo(() => {
		if (rows.length === 0 || columns.length === 0) {
			return {}
		}

		return detectColumnTypes(rows, columns)
	}, [rows, columns])

	const textColumns = useMemo(() => {
		return columns.filter((column) => columnTypes[column] === 'text')
	}, [columns, columnTypes])

	const numericColumns = useMemo(() => {
		return columns.filter((column) => columnTypes[column] === 'number')
	}, [columns, columnTypes])

	useEffect(() => {
		if (!labelColumn && textColumns.length > 0) {
			setLabelColumn(textColumns[0])
		}
	}, [labelColumn, textColumns])

	function handleValueColumnToggle(column) {
		setSelectedValueColumns((current) => {
			if (current.includes(column)) {
				return current.filter((item) => item !== column)
			}

			if (chartType === 'pie') {
				return [column]
			}

			return [...current, column]
		})
	}

	function moveValueColumnUp(index) {
		if (index === 0) {
			return
		}

		setSelectedValueColumns((current) => {
			const updated = [...current]
			const temp = updated[index - 1]
			updated[index - 1] = updated[index]
			updated[index] = temp
			return updated
		})
	}

	function moveValueColumnDown(index) {
		setSelectedValueColumns((current) => {
			if (index === current.length - 1) {
				return current
			}

			const updated = [...current]
			const temp = updated[index + 1]
			updated[index + 1] = updated[index]
			updated[index] = temp
			return updated
		})
	}

	useEffect(() => {
		if (chartType === 'pie' && selectedValueColumns.length > 1) {
			setSelectedValueColumns([selectedValueColumns[0]])
		}
	}, [chartType, selectedValueColumns])

	const chartData = useMemo(() => {
		if (rows.length === 0 || selectedValueColumns.length === 0) {
			return null
		}

		if (aggregateValues) {
			const summedItems = getColumnSums(rows, selectedValueColumns)
			const sortedItems = sortItems(summedItems, sortDirection)

			return buildAggregatedChartData(sortedItems, chartType, colourMode)
		}

		if (!labelColumn) {
			return null
		}

		const sortedRows = sortRows(
			rows,
			labelColumn,
			sortColumn || 'label',
			sortDirection
		)

		return buildRawChartData(
			sortedRows,
			chartType,
			labelColumn,
			selectedValueColumns,
			colourMode
		)
	}, [
		rows,
		labelColumn,
		selectedValueColumns,
		chartType,
		sortColumn,
		sortDirection,
		aggregateValues,
		colourMode
	])

	const chartOptions = useMemo(() => {
		return buildChartOptions(chartType, yAxisLabel)
	}, [chartType, yAxisLabel])

	function saveChartAsImage() {
		const chartInstance = chartRef.current

		if (!chartInstance) {
			return
		}

		const imageUrl = chartInstance.toBase64Image()
		const link = document.createElement('a')
		link.href = imageUrl
		link.download = 'chart.png'
		link.click()

		setSavedMessage('Chart image saved.')
	}

	function saveChartConfiguration() {
		const config = {
			chartType: chartType,
			labelColumn: labelColumn,
			selectedValueColumns: selectedValueColumns,
			yAxisLabel: yAxisLabel,
			sortColumn: sortColumn,
			sortDirection: sortDirection,
			aggregateValues: aggregateValues,
			colourMode: colourMode
		}

		localStorage.setItem('savedChartConfig', JSON.stringify(config))
		setSavedMessage('Chart configuration saved.')
	}

	function loadChartConfiguration() {
		const savedConfig = localStorage.getItem('savedChartConfig')

		if (!savedConfig) {
			setSavedMessage('No saved chart configuration found.')
			return
		}

		const parsedConfig = JSON.parse(savedConfig)

		setChartType(parsedConfig.chartType || 'bar')
		setLabelColumn(parsedConfig.labelColumn || '')
		setSelectedValueColumns(parsedConfig.selectedValueColumns || [])
		setYAxisLabel(parsedConfig.yAxisLabel || '')
		setSortColumn(parsedConfig.sortColumn || '')
		setSortDirection(parsedConfig.sortDirection || 'asc')
		setAggregateValues(parsedConfig.aggregateValues || false)
		setColourMode(parsedConfig.colourMode || 'column')
		setSavedMessage('Chart configuration loaded.')
	}

	function renderChart() {
		if (!chartData) {
			return <p>Please choose the chart options first.</p>
		}

		const commonProps = {
			ref: chartRef,
			data: chartData,
			options: chartOptions
		}

		if (chartType === 'bar') {
			return <Bar {...commonProps} />
		}

		if (chartType === 'line') {
			return <Line {...commonProps} />
		}

		if (chartType === 'pie') {
			return <Pie {...commonProps} />
		}

		return null
	}

	if (rows.length === 0) {
		return (
			<main style={{ padding: '24px' }}>
				<h1>Visualisations</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main style={{ padding: '24px' }}>
			<h1>Visualisations</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>

			<div style={{ marginTop: '24px' }}>
				<h2>Chart Setup</h2>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="chartType"><strong>Chart type: </strong></label>
					<select
						id="chartType"
						value={chartType}
						onChange={(e) => setChartType(e.target.value)}
					>
						<option value="bar">Bar</option>
						<option value="line">Line</option>
						<option value="pie">Pie</option>
					</select>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="labelColumn"><strong>Label column: </strong></label>
					<select
						id="labelColumn"
						value={labelColumn}
						onChange={(e) => setLabelColumn(e.target.value)}
					>
						<option value="">Select a label column</option>
						{textColumns.map((column) => (
							<option key={column} value={column}>
								{column}
							</option>
						))}
					</select>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<p><strong>Value columns:</strong></p>

					{numericColumns.length === 0 && <p>No numeric columns detected.</p>}

					{numericColumns.map((column) => (
						<label key={column} style={{ display: 'block', marginBottom: '6px' }}>
							<input
								type="checkbox"
								checked={selectedValueColumns.includes(column)}
								onChange={() => handleValueColumnToggle(column)}
							/>
							{' '}{column}
						</label>
					))}
				</div>

				{selectedValueColumns.length > 0 && (
					<div style={{ marginBottom: '16px' }}>
						<p><strong>Selected value column order:</strong></p>

						{selectedValueColumns.map((column, index) => (
							<div key={column} style={{ marginBottom: '8px' }}>
								<span>{column}</span>
								<button
									type="button"
									onClick={() => moveValueColumnUp(index)}
									style={{ marginLeft: '8px' }}
								>
									Up
								</button>
								<button
									type="button"
									onClick={() => moveValueColumnDown(index)}
									style={{ marginLeft: '8px' }}
								>
									Down
								</button>
							</div>
						))}
					</div>
				)}

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="sortColumn"><strong>Sort by: </strong></label>
					<select
						id="sortColumn"
						value={sortColumn}
						onChange={(e) => setSortColumn(e.target.value)}
					>
						<option value="">Default</option>
						<option value="label">Label</option>
						{selectedValueColumns.map((column) => (
							<option key={column} value={column}>
								{column}
							</option>
						))}
					</select>

					<select
						value={sortDirection}
						onChange={(e) => setSortDirection(e.target.value)}
						style={{ marginLeft: '8px' }}
					>
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</select>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<label>
						<input
							type="checkbox"
							checked={aggregateValues}
							onChange={(e) => setAggregateValues(e.target.checked)}
						/>
						{' '}Aggregate values
					</label>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="colourMode"><strong>Colour assignment: </strong></label>
					<select
						id="colourMode"
						value={colourMode}
						onChange={(e) => setColourMode(e.target.value)}
					>
						<option value="column">By column</option>
						<option value="row">By row</option>
					</select>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="yAxisLabel"><strong>Y-axis label: </strong></label>
					<input
						id="yAxisLabel"
						type="text"
						value={yAxisLabel}
						onChange={(e) => setYAxisLabel(e.target.value)}
						placeholder="Enter Y-axis label"
						style={{ marginLeft: '8px' }}
					/>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<button type="button" onClick={saveChartConfiguration}>
						Save Chart Settings
					</button>

					<button
						type="button"
						onClick={loadChartConfiguration}
						style={{ marginLeft: '8px' }}
					>
						Load Saved Settings
					</button>

					<button
						type="button"
						onClick={saveChartAsImage}
						style={{ marginLeft: '8px' }}
					>
						Save Chart Image
					</button>
				</div>

				{savedMessage && <p>{savedMessage}</p>}
			</div>

			<div style={{ marginTop: '32px', maxWidth: '1000px' }}>
				<h2>Chart Preview</h2>
				{renderChart()}
			</div>
		</main>
	)
}