'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as ChartJS from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { detectColumnTypes, parseDateMs } from '@/lib/analysis'

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

		const dateA = parseDateMs(valueA)
		const dateB = parseDateMs(valueB)
		if (dateA !== null && dateB !== null) {
			return dateA - dateB
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
					backgroundColor: items.map((_, index) => getColour(index, 0.75)),
					borderColor: items.map((_, index) => getBorderColour(index)),
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
					backgroundColor: items.map((_, index) => getColour(index, 0.65)),
					borderColor: items.map((_, index) => getBorderColour(index)),
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
					backgroundColor: rows.map((_, index) => getColour(index, 0.75)),
					borderColor: rows.map((_, index) => getBorderColour(index)),
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
					backgroundColor: rows.map((_, index) => getColour(index, 0.65)),
					borderColor: rows.map((_, index) => getBorderColour(index)),
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

function buildSeriesChartData(rows, labelColumn, valueColumn, seriesColumn) {
	const seriesValues = [...new Set(rows.map((row) => row[seriesColumn]))]
		.filter((v) => v !== null && v !== undefined && v !== '')
		.sort((a, b) => String(a).localeCompare(String(b)))

	const labelValues = [...new Set(rows.map((row) => row[labelColumn]))]
		.sort((a, b) => {
			if (typeof a === 'number' && typeof b === 'number') return a - b
			const dateA = parseDateMs(a)
			const dateB = parseDateMs(b)
			if (dateA !== null && dateB !== null) return dateA - dateB
			return String(a).localeCompare(String(b))
		})

	const datasets = seriesValues.map((seriesVal, index) => {
		const valueMap = new Map()

		for (let i = 0; i < rows.length; i++) {
			if (rows[i][seriesColumn] === seriesVal) {
				valueMap.set(rows[i][labelColumn], rows[i][valueColumn])
			}
		}

		return {
			label: String(seriesVal),
			data: labelValues.map((labelVal) => {
				const val = valueMap.get(labelVal)
				return typeof val === 'number' ? val : null
			}),
			backgroundColor: getColour(index, 0.65),
			borderColor: getBorderColour(index),
			borderWidth: 2,
			spanGaps: false
		}
	})

	return {
		labels: labelValues.map(String),
		datasets: datasets
	}
}

function buildChartOptions(chartType, yAxisLabel, yAxisMin, yAxisMax) {
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

	const yScale = {
		title: {
			display: Boolean(yAxisLabel),
			text: yAxisLabel
		}
	}

	if (yAxisMin !== '') {
		yScale.min = Number(yAxisMin)
	} else {
		yScale.beginAtZero = true
	}

	if (yAxisMax !== '') {
		yScale.max = Number(yAxisMax)
	}

	return {
		responsive: true,
		plugins: {
			legend: {
				display: true
			}
		},
		scales: {
			y: yScale
		}
	}
}

function Tip({ text }) {
	return (
		<span
			title={text}
			style={{ marginLeft: '5px', cursor: 'help', color: '#888', fontSize: '0.8em' }}
		>
			(?)
		</span>
	)
}

export default function VisualisationsPage() {
	const chartRef = useRef(null)

	const [rows, setRows] = useState([])
	const [columns, setColumns] = useState([])
	const [datasetName, setDatasetName] = useState('')
	const [loading, setLoading] = useState(true)

	const [chartType, setChartType] = useState('bar')
	const [labelColumn, setLabelColumn] = useState('')
	const [selectedValueColumns, setSelectedValueColumns] = useState([])
	const [seriesColumn, setSeriesColumn] = useState('')
	const [yAxisLabel, setYAxisLabel] = useState('')
	const [yAxisMin, setYAxisMin] = useState('')
	const [yAxisMax, setYAxisMax] = useState('')
	const [sortColumn, setSortColumn] = useState('')
	const [sortDirection, setSortDirection] = useState('asc')
	const [aggregateValues, setAggregateValues] = useState(false)
	const [colourMode, setColourMode] = useState('column')
	const [savedMessage, setSavedMessage] = useState('')

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (!activeId) { setLoading(false); return }

			try {
				const res = await fetch(`/api/datasets/${activeId}`)
				if (!res.ok) return
				const dataset = await res.json()
				setRows(dataset.rows)
				setColumns(dataset.columns)
				setDatasetName(dataset.name || 'Unnamed dataset')
			} catch {} finally {
				setLoading(false)
			}
		}

		load()
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
		if (!labelColumn && columns.length > 0) {
			if (textColumns.length === 0) {
				setLabelColumn(columns[0])
				return
			}

			let bestColumn = textColumns[0]
			let bestCount = 0

			for (const col of textColumns) {
				const uniqueCount = new Set(rows.map((r) => r[col])).size
				if (uniqueCount > bestCount) {
					bestCount = uniqueCount
					bestColumn = col
				}
			}

			setLabelColumn(bestColumn)
		}
	}, [labelColumn, columns, textColumns, rows])

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

		if (seriesColumn && selectedValueColumns.length === 1) {
			return buildSeriesChartData(rows, labelColumn, selectedValueColumns[0], seriesColumn)
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
		seriesColumn,
		chartType,
		sortColumn,
		sortDirection,
		aggregateValues,
		colourMode
	])

	const chartOptions = useMemo(() => {
		return buildChartOptions(chartType, yAxisLabel, yAxisMin, yAxisMax)
	}, [chartType, yAxisLabel, yAxisMin, yAxisMax])

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
			seriesColumn: seriesColumn,
			yAxisLabel: yAxisLabel,
			yAxisMin: yAxisMin,
			yAxisMax: yAxisMax,
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
		setSeriesColumn(parsedConfig.seriesColumn || '')
		setYAxisLabel(parsedConfig.yAxisLabel || '')
		setYAxisMin(parsedConfig.yAxisMin ?? '')
		setYAxisMax(parsedConfig.yAxisMax ?? '')
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

	if (loading) {
		return (
			<main>
				<h1>Visualisations</h1>
				<p>Loading...</p>
			</main>
		)
	}

	if (rows.length === 0) {
		return (
			<main>
				<h1>Visualisations</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main>
			<h1>Visualisations</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>

			<div style={{ marginTop: '24px' }}>
				<h2>Chart Setup</h2>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="chartType"><strong>Chart type<Tip text="Bar: compare values side by side. Line: show change over time or a continuous trend. Pie: show proportions of a whole (one value column only)." />: </strong></label>
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
					<label htmlFor="labelColumn"><strong>Label column<Tip text="The column used as the x-axis on bar and line charts, or as slice names on a pie chart. Works best with a column that has a unique value per row, such as a date or name." />: </strong></label>
					<select
						id="labelColumn"
						value={labelColumn}
						onChange={(e) => setLabelColumn(e.target.value)}
					>
						<option value="">Select a label column</option>
						{columns.map((column) => (
							<option key={column} value={column}>
								{column}
							</option>
						))}
					</select>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<p><strong>Value columns<Tip text="The numeric columns to plot as bars, lines, or pie slices. Tick one or more columns. For pie charts only one column can be selected." />:</strong></p>

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
						<p><strong>Selected value column order<Tip text="Change the order that value columns appear in the chart legend and as grouped bars. Use the Up and Down buttons to reorder." />:</strong></p>

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
					<label htmlFor="seriesColumn"><strong>Series column<Tip text="Split the data into separate lines or bar groups based on a column's unique values. Only works when a single value column is selected." />: </strong></label>
					<select
						id="seriesColumn"
						value={seriesColumn}
						onChange={(e) => setSeriesColumn(e.target.value)}
					>
						<option value="">None</option>
						{columns.map((column) => (
							<option key={column} value={column}>
								{column}
							</option>
						))}
					</select>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="sortColumn"><strong>Sort by<Tip text="Choose which column determines the order of bars or points on the chart. 'Label' sorts by the x-axis values (alphabetically or by date). Choose a value column to sort by its numbers instead." />: </strong></label>
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
						title="Ascending: lowest to highest, A to Z, or oldest to newest. Descending reverses the order."
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
						{' '}<strong>Aggregate values<Tip text="When ticked, each selected value column is summed into a single total bar or slice, rather than showing one bar per row. Useful for totalling up categories." /></strong>
					</label>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<label htmlFor="colourMode"><strong>Colour assignment<Tip text="By column: each value column gets its own colour, so all bars for the same column share a colour. By row: each individual bar or data point gets its own colour, useful when bars represent different categories." />: </strong></label>
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
					<label htmlFor="yAxisLabel"><strong>Y-axis label<Tip text="Optional text displayed alongside the y-axis to describe the units or meaning of the values, for example 'Population' or 'pH level'. Leave blank to show no label." />: </strong></label>
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
					<label htmlFor="yAxisMin"><strong>Y-axis min<Tip text="Set the lowest value shown on the y-axis. Leave blank to let the chart scale automatically. Setting a minimum is useful when values are close together and you want to see fine differences." />: </strong></label>
					<input
						id="yAxisMin"
						type="number"
						value={yAxisMin}
						onChange={(e) => setYAxisMin(e.target.value)}
						placeholder="Automatic"
						style={{ marginLeft: '8px', width: '120px' }}
					/>

					<label htmlFor="yAxisMax" style={{ marginLeft: '16px' }}><strong>Y-axis max<Tip text="Set the highest value shown on the y-axis. Leave blank to let the chart scale automatically. Useful for fixing the scale when comparing multiple charts." />: </strong></label>
					<input
						id="yAxisMax"
						type="number"
						value={yAxisMax}
						onChange={(e) => setYAxisMax(e.target.value)}
						placeholder="Automatic"
						style={{ marginLeft: '8px', width: '120px' }}
					/>
				</div>

				<div style={{ marginBottom: '16px' }}>
					<button
						type="button"
						onClick={saveChartConfiguration}
						title="Saves your current chart settings (type, columns, sort order, axis options) to this browser so you can reload them later."
					>
						Save Chart Settings
					</button>

					<button
						type="button"
						onClick={loadChartConfiguration}
						style={{ marginLeft: '8px' }}
						title="Restores the chart settings you last saved. This does not affect the data filter."
					>
						Load Saved Settings
					</button>

					<button
						type="button"
						onClick={saveChartAsImage}
						style={{ marginLeft: '8px' }}
						title="Downloads the current chart as a PNG image file."
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
