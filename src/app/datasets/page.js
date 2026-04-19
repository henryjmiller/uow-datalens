'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function DatasetsPage() {
	const [file, setFile] = useState(null)
	const [message, setMessage] = useState('')
	const [preview, setPreview] = useState([])
	const [rowCount, setRowCount] = useState(0)
	const [columns, setColumns] = useState([])

	async function handleSubmit(e) {
		e.preventDefault()

		if (!file) {
			setMessage('Please choose a CSV file.')
			return
		}

		const formData = new FormData()
		formData.append('file', file)

		try {
			setMessage('Uploading and parsing...')

			const response = await fetch('/api/datasets/upload', {
				method: 'POST',
				body: formData
			})

			const data = await response.json()

			if (!response.ok) {
				setMessage(data.error || 'Upload failed.')
				setPreview([])
				setRowCount(0)
				setColumns([])
				return
			}

			setMessage(data.message || 'Upload successful.')
			setPreview(data.preview || [])
			setRowCount(data.rowCount || 0)
			setColumns(data.columns || [])

			localStorage.setItem('uploadedDataset', JSON.stringify(data.rows || []))
			localStorage.setItem('uploadedDatasetColumns', JSON.stringify(data.columns || []))
			localStorage.setItem('uploadedDatasetName', file.name)

		} catch (error) {
			setMessage('Something went wrong while uploading the file.')
			setPreview([])
			setRowCount(0)
			setColumns([])
		}
	}

	return (
		<main style={{ padding: '24px' }}>
			<h1>Datasets</h1>
			<p>Upload a CSV file to preview and parse its contents.</p>

			<form onSubmit={handleSubmit}>
				<input
					type="file"
					accept=".csv,text/csv"
					onChange={(e) => setFile(e.target.files[0] || null)}
				/>

				<div style={{ marginTop: '12px' }}>
					<button type="submit">Upload CSV</button>
				</div>
			</form>

			{message && <p style={{ marginTop: '16px' }}>{message}</p>}

			{rowCount > 0 && (
				<div style={{ marginTop: '16px' }}>
					<p><strong>Rows loaded:</strong> {rowCount}</p>
					<p><strong>Columns detected:</strong> {columns.join(', ')}</p>
					<p>
						<Link href="/analysis">Go to analysis</Link>
					</p>
				</div>
			)}

			{preview.length > 0 && (
				<div style={{ marginTop: '24px' }}>
					<h2>Preview</h2>
					<pre style={{ whiteSpace: 'pre-wrap' }}>
						{JSON.stringify(preview, null, 2)}
					</pre>
				</div>
			)}
		</main>
	)
}