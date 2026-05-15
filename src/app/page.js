import Link from 'next/link'

export default function Home() {
	return (
		<main style={{ padding: '24px', maxWidth: '720px' }}>
			<h1>DataLens</h1>
			<p>
				DataLens is a web-based data analysis tool. Upload a CSV dataset and use
				the built-in tools to explore, clean, analyse, model, and visualise your data.
			</p>

			<div style={{ marginTop: '32px' }}>
				<h2>Getting started</h2>
				<ol style={{ lineHeight: '2' }}>
					<li>
						<Link href="/datasets">Datasets</Link> — upload one or more CSV files.
						Datasets are stored persistently so they are available across sessions.
						You can also clean and filter your data before analysis.
					</li>
					<li>
						<Link href="/analysis">Analysis</Link> — once a dataset is active, view
						a summary of its columns including data types, value counts, and basic
						statistics. Drill into correlation analysis, trend detection, and outlier
						identification.
					</li>
					<li>
						<Link href="/predictive-modelling">Predictive Modelling</Link> — fit regression
						models to your data and forecast future values. Supports standard linear
						regression across numeric columns and time series modelling using polynomial
						regression to capture trends over time.
					</li>
					<li>
						<Link href="/visualisations">Visualisations</Link> — build bar, line, and
						pie charts from your dataset. Configure the label column, value columns,
						series grouping, sort order, and axis ranges. Save chart settings and
						export charts as images.
					</li>
				</ol>
			</div>
		</main>
	)
}
