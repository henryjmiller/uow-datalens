'use client'

import { useEffect, useState, useMemo } from 'react'
import { SimpleLinearRegression } from 'ml-regression-simple-linear'
import regression from 'regression'
import { Scatter } from 'react-chartjs-2'
import * as ChartJS from 'chart.js'
import { detectColumnTypes, parseDateMs } from '@/lib/analysis'

ChartJS.Chart.register(...ChartJS.registerables)

function toDecimalYear(ms) {
	const date = new Date(ms)
	const year = date.getFullYear()
	const startOfYear = new Date(year, 0, 1).getTime()
	const endOfYear = new Date(year + 1, 0, 1).getTime()
	return year + (ms - startOfYear) / (endOfYear - startOfYear)
}

function inferDecimalPlaces(values) {
	let max = 0
	for (const v of values.slice(0, 30)) {
		const str = String(v)
		const dot = str.indexOf('.')
		if (dot !== -1) max = Math.max(max, str.length - dot - 1)
	}
	return max
}

function parseToNumeric(value) {
	if (typeof value === 'number') return value
	const date = parseDateMs(String(value))
	return date ? toDecimalYear(date) : null
}

function Tip({ text }) {
	return (
		<span title={text} style={{ marginLeft: '5px', cursor: 'help', color: '#888', fontSize: '0.8em' }}>
			(?)
		</span>
	)
}

export default function PredictiveModellingPage() {
	const [rows, setRows] = useState([])
	const [columns, setColumns] = useState([])
	const [columnTypes, setColumnTypes] = useState({})
	const [datasetName, setDatasetName] = useState('')
	const [loading, setLoading] = useState(true)
	const [mode, setMode] = useState('timeseries')

	const [entityColumn, setEntityColumn] = useState('')
	const [entityValue, setEntityValue] = useState('')
	const [polynomialOrder, setPolynomialOrder] = useState(2)
	const [tsPredictX, setTsPredictX] = useState('')

	const [longDateColumn, setLongDateColumn] = useState('')
	const [longValueColumn, setLongValueColumn] = useState('')
	const [longEntityColumn, setLongEntityColumn] = useState('')
	const [longEntityValue, setLongEntityValue] = useState('')
	const [longPredictX, setLongPredictX] = useState('')

	const [filterColumn, setFilterColumn] = useState('')
	const [filterValue, setFilterValue] = useState('')
	const [xColumn, setXColumn] = useState('')
	const [yColumn, setYColumn] = useState('')
	const [stdPredictX, setStdPredictX] = useState('')

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (!activeId) { setLoading(false); return }

			try {
				const res = await fetch(`/api/datasets/${activeId}`)
				if (!res.ok) return

				const dataset = await res.json()
				const types = detectColumnTypes(dataset.rows, dataset.columns)

				setRows(dataset.rows)
				setColumns(dataset.columns)
				setColumnTypes(types)
				setDatasetName(dataset.name || 'Unnamed dataset')

				const hasYearCols = dataset.columns.some((col) => {
					const n = Number(col)
					return Number.isInteger(n) && n >= 1800 && n <= 2100
				})
				setMode(hasYearCols ? 'timeseries' : 'standard')
			} catch {} finally {
				setLoading(false)
			}
		}

		load()
	}, [])

	const textColumns = useMemo(() => columns.filter((c) => columnTypes[c] === 'text'), [columns, columnTypes])
	const numericColumns = useMemo(() => columns.filter((c) => columnTypes[c] === 'number'), [columns, columnTypes])

	const longDateSelectorColumns = useMemo(() => {
		const dateLike = columns.filter((col) => {
			if (columnTypes[col] !== 'text') return false
			const sample = rows.slice(0, 20).map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== '')
			if (sample.length === 0) return false
			return sample.filter((v) => parseDateMs(String(v)) !== null).length / sample.length >= 0.8
		})
		return [...numericColumns, ...dateLike]
	}, [rows, columns, columnTypes, numericColumns])

	const yearColumns = useMemo(() => (
		columns
			.filter((col) => { const n = Number(col); return Number.isInteger(n) && n >= 1800 && n <= 2100 })
			.sort((a, b) => Number(a) - Number(b))
	), [columns])

	const entityValues = useMemo(() => {
		if (!entityColumn) return []
		const seen = new Set()
		for (const row of rows) {
			const val = row[entityColumn]
			if (val !== null && val !== undefined && val !== '') seen.add(String(val))
		}
		return [...seen].sort()
	}, [rows, entityColumn])

	const tsResult = useMemo(() => {
		if (!entityColumn || !entityValue || yearColumns.length < 2) return null

		const entityRow = rows.find((row) => String(row[entityColumn]) === entityValue)
		if (!entityRow) return null

		const data = []

		for (const col of yearColumns) {
			const val = entityRow[col]
			if (typeof val === 'number' && !Number.isNaN(val)) {
				data.push([Number(col), val])
			}
		}

		if (data.length < polynomialOrder + 1) return null

		const xMin = data[0][0]
		const xMax = data[data.length - 1][0]
		const xRange = xMax - xMin || 1

		const yValues = data.map((d) => d[1])
		const yMin = Math.min(...yValues)
		const yMax = Math.max(...yValues)
		const yRange = yMax - yMin || 1

		const normalised = data.map(([x, y]) => [(x - xMin) / xRange, (y - yMin) / yRange])

		let result
		try {
			result = regression.polynomial(normalised, { order: polynomialOrder, precision: 10 })
		} catch {
			return null
		}
		if (!result || isNaN(result.r2)) return null

		return {
			r2: result.r2,
			equationString: result.string,
			predict: (x) => result.predict((x - xMin) / xRange)[1] * yRange + yMin,
			pointCount: data.length,
			decimalPlaces: inferDecimalPlaces(yValues),
			x: data.map((d) => d[0]),
			y: yValues
		}
	}, [rows, entityColumn, entityValue, yearColumns, polynomialOrder])

	const tsPredictedY = useMemo(() => {
		if (!tsResult || tsPredictX === '') return null
		const n = Number(tsPredictX)
		if (Number.isNaN(n)) return null
		return tsResult.predict(n)
	}, [tsResult, tsPredictX])

	const tsChartData = useMemo(() => {
		if (!tsResult) return null

		const { x, y } = tsResult
		const minX = x[0]
		const extendTo = tsPredictX !== '' && !Number.isNaN(Number(tsPredictX))
			? Math.max(x[x.length - 1], Number(tsPredictX))
			: x[x.length - 1]

		const curvePoints = []
		const steps = 200
		const stepSize = (extendTo - minX) / steps
		for (let i = 0; i <= steps; i++) {
			const xi = minX + i * stepSize
			curvePoints.push({ x: xi, y: tsResult.predict(xi) })
		}

		return {
			datasets: [
				{
					label: entityValue,
					data: x.map((xi, i) => ({ x: xi, y: y[i] })),
					backgroundColor: 'hsla(210, 70%, 55%, 0.8)',
					borderColor: 'hsla(210, 70%, 55%, 0.8)',
					pointRadius: 5,
					showLine: true,
					borderWidth: 1.5
				},
				{
					label: `Polynomial fit (order ${polynomialOrder})`,
					type: 'line',
					data: curvePoints,
					borderColor: 'hsl(0, 70%, 50%)',
					backgroundColor: 'transparent',
					pointRadius: 0,
					borderWidth: 2
				}
			]
		}
	}, [tsResult, entityValue, tsPredictX, polynomialOrder])

	const longEntityValues = useMemo(() => {
		if (!longEntityColumn) return []
		const seen = new Set()
		for (const row of rows) {
			const val = row[longEntityColumn]
			if (val !== null && val !== undefined && val !== '') seen.add(String(val))
		}
		return [...seen].sort()
	}, [rows, longEntityColumn])

	const longResult = useMemo(() => {
		if (!longDateColumn || !longValueColumn) return null

		const sourceRows = longEntityColumn && longEntityValue
			? rows.filter((row) => String(row[longEntityColumn]) === longEntityValue)
			: rows

		const data = []
		for (const row of sourceRows) {
			const x = parseToNumeric(row[longDateColumn])
			const y = row[longValueColumn]
			if (x !== null && !Number.isNaN(x) && typeof y === 'number' && !Number.isNaN(y)) {
				data.push([x, y])
			}
		}

		data.sort((a, b) => a[0] - b[0])

		if (data.length < polynomialOrder + 1) return null

		const xMin = data[0][0]
		const xMax = data[data.length - 1][0]
		const xRange = xMax - xMin || 1

		const yValues = data.map((d) => d[1])
		const yMin = Math.min(...yValues)
		const yMax = Math.max(...yValues)
		const yRange = yMax - yMin || 1

		const normalised = data.map(([x, y]) => [(x - xMin) / xRange, (y - yMin) / yRange])

		let result
		try {
			result = regression.polynomial(normalised, { order: polynomialOrder, precision: 10 })
		} catch {
			return null
		}
		if (!result || isNaN(result.r2)) return null

		return {
			r2: result.r2,
			equationString: result.string,
			predict: (x) => result.predict((x - xMin) / xRange)[1] * yRange + yMin,
			pointCount: data.length,
			decimalPlaces: inferDecimalPlaces(yValues),
			x: data.map((d) => d[0]),
			y: yValues
		}
	}, [rows, longDateColumn, longValueColumn, longEntityColumn, longEntityValue, polynomialOrder])

	const longPredictedY = useMemo(() => {
		if (!longResult || longPredictX === '') return null
		const n = Number(longPredictX)
		if (Number.isNaN(n)) return null
		return longResult.predict(n)
	}, [longResult, longPredictX])

	const longChartData = useMemo(() => {
		if (!longResult) return null

		const { x, y } = longResult
		const minX = x[0]
		const extendTo = longPredictX !== '' && !Number.isNaN(Number(longPredictX))
			? Math.max(x[x.length - 1], Number(longPredictX))
			: x[x.length - 1]

		const curvePoints = []
		const steps = 200
		const stepSize = (extendTo - minX) / steps
		for (let i = 0; i <= steps; i++) {
			const xi = minX + i * stepSize
			curvePoints.push({ x: xi, y: longResult.predict(xi) })
		}

		const step = Math.max(1, Math.floor(x.length / 500))
		const scatterPoints = []
		for (let i = 0; i < x.length; i += step) {
			scatterPoints.push({ x: x[i], y: y[i] })
		}

		return {
			datasets: [
				{
					label: longEntityValue || longValueColumn,
					data: scatterPoints,
					backgroundColor: 'hsla(210, 70%, 55%, 0.8)',
					borderColor: 'hsla(210, 70%, 55%, 0.8)',
					pointRadius: 4,
					showLine: true,
					borderWidth: 1.5
				},
				{
					label: `Polynomial fit (order ${polynomialOrder})`,
					type: 'line',
					data: curvePoints,
					borderColor: 'hsl(0, 70%, 50%)',
					backgroundColor: 'transparent',
					pointRadius: 0,
					borderWidth: 2
				}
			]
		}
	}, [longResult, longValueColumn, longEntityValue, longPredictX, polynomialOrder])

	const stdFilterValues = useMemo(() => {
		if (!filterColumn) return []
		const seen = new Set()
		for (const row of rows) {
			const val = row[filterColumn]
			if (val !== null && val !== undefined && val !== '') seen.add(String(val))
		}
		return [...seen].sort()
	}, [rows, filterColumn])

	const stdFilteredRows = useMemo(() => {
		if (!filterColumn || !filterValue) return rows
		return rows.filter((row) => String(row[filterColumn]) === filterValue)
	}, [rows, filterColumn, filterValue])

	const stdResult = useMemo(() => {
		if (!xColumn || !yColumn) return null

		const x = []
		const y = []

		for (const row of stdFilteredRows) {
			const xVal = row[xColumn]
			const yVal = row[yColumn]
			if (typeof xVal === 'number' && !Number.isNaN(xVal) &&
				typeof yVal === 'number' && !Number.isNaN(yVal)) {
				x.push(xVal)
				y.push(yVal)
			}
		}

		if (x.length < 2) return null

		const model = new SimpleLinearRegression(x, y)
		const { r2 } = model.score(x, y)

		return { slope: model.slope, intercept: model.intercept, r2, pointCount: x.length, x, y, model }
	}, [stdFilteredRows, xColumn, yColumn])

	const stdPredictedY = useMemo(() => {
		if (!stdResult || stdPredictX === '') return null
		const n = Number(stdPredictX)
		if (Number.isNaN(n)) return null
		return stdResult.model.predict(n)
	}, [stdResult, stdPredictX])

	const stdChartData = useMemo(() => {
		if (!stdResult) return null

		const { x, y, slope, intercept } = stdResult
		const step = Math.max(1, Math.floor(x.length / 500))
		const scatterPoints = []
		for (let i = 0; i < x.length; i += step) {
			scatterPoints.push({ x: x[i], y: y[i] })
		}

		const minX = Math.min(...x)
		const maxX = Math.max(...x)

		return {
			datasets: [
				{
					label: `${xColumn} vs ${yColumn}`,
					data: scatterPoints,
					backgroundColor: 'hsla(210, 70%, 55%, 0.5)',
					pointRadius: 4
				},
				{
					label: 'Regression line',
					type: 'line',
					data: [
						{ x: minX, y: slope * minX + intercept },
						{ x: maxX, y: slope * maxX + intercept }
					],
					borderColor: 'hsl(0, 70%, 50%)',
					backgroundColor: 'transparent',
					pointRadius: 0,
					borderWidth: 2
				}
			]
		}
	}, [stdResult, xColumn, yColumn])

	const chartOptions = (xLabel, yLabel) => ({
		responsive: true,
		plugins: { legend: { display: true } },
		scales: {
			x: { type: 'linear', title: { display: Boolean(xLabel), text: xLabel } },
			y: { title: { display: Boolean(yLabel), text: yLabel } }
		}
	})

	if (loading) {
		return <main><h1>Predictive Modelling</h1><p>Loading...</p></main>
	}

	if (rows.length === 0) {
		return (
			<main>
				<h1>Predictive Modelling</h1>
				<p>No dataset found. Please upload a CSV on the datasets page first.</p>
			</main>
		)
	}

	return (
		<main>
			<h1>Predictive Modelling</h1>
			<p><strong>Dataset:</strong> {datasetName}</p>

			<div style={{ marginTop: '16px' }}>
				<label><strong>Mode<Tip text="Time series mode uses date-named columns as the x-axis, fitting a polynomial curve to the values of a single selected entity. Standard mode fits a straight line between two numeric columns." />: </strong></label>
				<select value={mode} onChange={(e) => setMode(e.target.value)}>
					<option value="timeseries">Time series</option>
					<option value="standard">Standard (two numeric columns)</option>
				</select>
			</div>

			{mode === 'timeseries' && (
				<div style={{ marginTop: '24px' }}>
					<h2>Time Series Regression</h2>
					<p>
						A polynomial curve is fitted to a series of values over time and can be used to predict values at any point in time.
					</p>

					<div style={{ marginBottom: '16px', marginTop: '16px' }}>
						<label htmlFor="polynomialOrder"><strong>Polynomial order<Tip text="Controls the degree of the fitted curve. A lower order produces a smoother, more generalised curve. A higher order follows the data more closely but risks overfitting, making predictions outside the data range less reliable. Start with 2 and increase only if R² is low." />: </strong></label>
						<select
							id="polynomialOrder"
							value={polynomialOrder}
							onChange={(e) => setPolynomialOrder(Number(e.target.value))}
						>
							<option value={2}>2 — quadratic</option>
							<option value={3}>3 — cubic</option>
							<option value={4}>4 — quartic</option>
							<option value={5}>5 — quintic</option>
						</select>
					</div>

					{yearColumns.length >= 2 ? (
						<>
							<div style={{ marginBottom: '16px' }}>
								<label htmlFor="entityColumn"><strong>Group by<Tip text="Select the column that identifies each entity. You will then choose a single value from this column to use as the data series." />: </strong></label>
								<select
									id="entityColumn"
									value={entityColumn}
									onChange={(e) => { setEntityColumn(e.target.value); setEntityValue('') }}
								>
									<option value="">Select a column</option>
									{textColumns.map((col) => <option key={col} value={col}>{col}</option>)}
								</select>
							</div>

							{entityColumn && (
								<div style={{ marginBottom: '16px' }}>
									<label htmlFor="entityValue"><strong>{entityColumn}<Tip text="Select the specific entity to model. The regression is fitted using only that entity's values across the date columns." />: </strong></label>
									<select
										id="entityValue"
										value={entityValue}
										onChange={(e) => setEntityValue(e.target.value)}
									>
										<option value="">Select a value</option>
										{entityValues.map((val) => <option key={val} value={val}>{val}</option>)}
									</select>
								</div>
							)}

							{tsResult && (
								<>
									<div style={{ marginTop: '24px' }}>
										<h2>Results</h2>
										<ul>
											<li><strong>Equation:</strong> {tsResult.equationString}</li>
											<li><strong>R²:</strong> {tsResult.r2.toFixed(4)}</li>
											<li><strong>Data points:</strong> {tsResult.pointCount}</li>
										</ul>
									</div>

									<div style={{ marginTop: '24px' }}>
										<h2>Predict</h2>
										<label htmlFor="tsPredictX">
											<strong>Date<Tip text="Enter a date value to get the predicted value at that point on the fitted curve. Values outside the range of the data are extrapolations and become less reliable the further they extend beyond the last data point." />: </strong>
											<input
												id="tsPredictX"
												type="number"
												value={tsPredictX}
												onChange={(e) => setTsPredictX(e.target.value)}
												style={{ marginLeft: '8px', width: '140px' }}
											/>
										</label>

										{tsPredictedY !== null && (
											<p style={{ marginTop: '8px' }}>
												<strong>Predicted value:</strong> {tsPredictedY.toFixed(tsResult.decimalPlaces)}
											</p>
										)}
									</div>

									<div style={{ marginTop: '24px', maxWidth: '800px' }}>
										<h2>Chart</h2>
										{tsChartData && <Scatter data={tsChartData} options={chartOptions('Date', entityColumn)} />}
									</div>
								</>
							)}
						</>
					) : (
						<>
							<div style={{ marginBottom: '16px' }}>
								<label htmlFor="longDateColumn"><strong>Date column<Tip text="The column that represents time or order. Numeric columns are used directly. Date string columns (DD/MM/YYYY or YYYY-MM-DD) are automatically converted to a numeric year value for the regression." />: </strong></label>
								<select
									id="longDateColumn"
									value={longDateColumn}
									onChange={(e) => setLongDateColumn(e.target.value)}
								>
									<option value="">Select a column</option>
									{longDateSelectorColumns.map((col) => <option key={col} value={col}>{col}</option>)}
								</select>
							</div>

							<div style={{ marginBottom: '16px' }}>
								<label htmlFor="longValueColumn"><strong>Value column<Tip text="The numeric column whose values you want to model and predict. These become the y-axis of the regression." />: </strong></label>
								<select
									id="longValueColumn"
									value={longValueColumn}
									onChange={(e) => setLongValueColumn(e.target.value)}
								>
									<option value="">Select a column</option>
									{numericColumns.filter((c) => c !== longDateColumn).map((col) => <option key={col} value={col}>{col}</option>)}
								</select>
							</div>

							<div style={{ marginBottom: '16px' }}>
								<label htmlFor="longEntityColumn"><strong>Group by<Tip text="Select the column that identifies each entity. Leave blank to use all rows." /> (optional): </strong></label>
								<select
									id="longEntityColumn"
									value={longEntityColumn}
									onChange={(e) => { setLongEntityColumn(e.target.value); setLongEntityValue('') }}
								>
									<option value="">No grouping — use all rows</option>
									{textColumns.map((col) => <option key={col} value={col}>{col}</option>)}
								</select>
							</div>

							{longEntityColumn && (
								<div style={{ marginBottom: '16px' }}>
									<label htmlFor="longEntityValue"><strong>{longEntityColumn}<Tip text="Select the specific entity to model. Only rows matching this value will be used." />: </strong></label>
									<select
										id="longEntityValue"
										value={longEntityValue}
										onChange={(e) => setLongEntityValue(e.target.value)}
									>
										<option value="">Select a value</option>
										{longEntityValues.map((val) => <option key={val} value={val}>{val}</option>)}
									</select>
								</div>
							)}

							{longResult && (
								<>
									<div style={{ marginTop: '24px' }}>
										<h2>Results</h2>
										<ul>
											<li><strong>Equation:</strong> {longResult.equationString}</li>
											<li><strong>R²:</strong> {longResult.r2.toFixed(4)}</li>
											<li><strong>Data points:</strong> {longResult.pointCount}</li>
										</ul>
									</div>

									<div style={{ marginTop: '24px' }}>
										<h2>Predict</h2>
										<label htmlFor="longPredictX">
											<strong>Year<Tip text="Enter a year value to predict at that point on the fitted curve. Values outside the data range become less reliable the further they extend beyond the last data point." />: </strong>
											<input
												id="longPredictX"
												type="number"
												value={longPredictX}
												onChange={(e) => setLongPredictX(e.target.value)}
												placeholder="e.g. 2025.5"
												style={{ marginLeft: '8px', width: '140px' }}
											/>
										</label>

										{longPredictedY !== null && (
											<p style={{ marginTop: '8px' }}>
												<strong>Predicted value:</strong> {longPredictedY.toFixed(longResult.decimalPlaces)}
											</p>
										)}
									</div>

									<div style={{ marginTop: '24px', maxWidth: '800px' }}>
										<h2>Chart</h2>
										{longChartData && <Scatter data={longChartData} options={chartOptions('Year', longValueColumn)} />}
									</div>
								</>
							)}
						</>
					)}
				</div>
			)}

			{mode === 'standard' && (
				<div style={{ marginTop: '24px' }}>
					<h2>Standard Regression</h2>
					<p>Select two numeric columns to fit a straight regression line. The optional filter narrows the data to a specific group before fitting.</p>

					<div style={{ marginTop: '16px', marginBottom: '16px' }}>
						<label htmlFor="filterColumn"><strong>Filter by<Tip text="Narrows the dataset to a single group before fitting the regression. Leave blank to use all rows." /> (optional): </strong></label>
						<select
							id="filterColumn"
							value={filterColumn}
							onChange={(e) => { setFilterColumn(e.target.value); setFilterValue('') }}
						>
							<option value="">No filter</option>
							{textColumns.map((col) => <option key={col} value={col}>{col}</option>)}
						</select>

						{filterColumn && (
							<select
								value={filterValue}
								onChange={(e) => setFilterValue(e.target.value)}
								style={{ marginLeft: '8px' }}
							>
								<option value="">All values</option>
								{stdFilterValues.map((val) => <option key={val} value={val}>{val}</option>)}
							</select>
						)}
					</div>

					<div style={{ marginBottom: '16px' }}>
						<label htmlFor="xColumn"><strong>X (independent)<Tip text="The input variable, the column whose values are used to predict the output. Changes in X drive the predicted changes in Y." />: </strong></label>
						<select id="xColumn" value={xColumn} onChange={(e) => setXColumn(e.target.value)}>
							<option value="">Select a column</option>
							{numericColumns.map((col) => <option key={col} value={col}>{col}</option>)}
						</select>
					</div>

					<div style={{ marginBottom: '16px' }}>
						<label htmlFor="yColumn"><strong>Y (dependent)<Tip text="The output variable, the column whose value the regression is trying to predict. The model finds the straight line that best explains Y as a function of X." />: </strong></label>
						<select id="yColumn" value={yColumn} onChange={(e) => setYColumn(e.target.value)}>
							<option value="">Select a column</option>
							{numericColumns.filter((c) => c !== xColumn).map((col) => <option key={col} value={col}>{col}</option>)}
						</select>
					</div>

					{stdResult && (
						<>
							<div style={{ marginTop: '24px' }}>
								<h2>Results</h2>
								<ul>
									<li><strong>Equation:</strong> y = {stdResult.slope.toFixed(4)}x {stdResult.intercept >= 0 ? '+' : ''} {stdResult.intercept.toFixed(4)}</li>
									<li><strong>Slope:</strong> {stdResult.slope.toFixed(6)}</li>
									<li><strong>Intercept:</strong> {stdResult.intercept.toFixed(6)}</li>
									<li><strong>R²:</strong> {stdResult.r2.toFixed(4)}</li>
									<li><strong>Data points:</strong> {stdResult.pointCount}</li>
								</ul>
							</div>

							<div style={{ marginTop: '24px' }}>
								<h2>Predict</h2>
								<label htmlFor="stdPredictX">
									<strong>{xColumn || 'X'}<Tip text="Enter an X value to get the predicted Y from the fitted regression line." />: </strong>
									<input
										id="stdPredictX"
										type="number"
										value={stdPredictX}
										onChange={(e) => setStdPredictX(e.target.value)}
										placeholder={`Enter a ${xColumn} value`}
										style={{ marginLeft: '8px', width: '180px' }}
									/>
								</label>

								{stdPredictedY !== null && (
									<p style={{ marginTop: '8px' }}>
										<strong>Predicted {yColumn}:</strong> {stdPredictedY.toFixed(4)}
									</p>
								)}
							</div>

							<div style={{ marginTop: '24px', maxWidth: '800px' }}>
								<h2>Chart</h2>
								{stdChartData && <Scatter data={stdChartData} options={chartOptions(xColumn, yColumn)} />}
							</div>
						</>
					)}
				</div>
			)}
		</main>
	)
}
