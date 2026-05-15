'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function DatasetsPage() {
	const [file, setFile] = useState(null)
	const [message, setMessage] = useState('')
	const [preview, setPreview] = useState([])
	const [datasets, setDatasets] = useState([])
	const [activeDatasetId, setActiveDatasetId] = useState(null)
	const [activating, setActivating] = useState(false)

	useEffect(() => {
		async function load() {
			const activeId = localStorage.getItem('activeDatasetId')
			if (activeId) setActiveDatasetId(activeId)

			try {
				const res = await fetch('/api/datasets')
				if (!res.ok) return
				setDatasets(await res.json())
			} catch {}
		}

		load()
	}, [])

	async function activateDataset(id) {
		setActivating(true)
		try {
			const res = await fetch(`/api/datasets/${id}`)
			if (!res.ok) {
				setMessage('Failed to load dataset.')
				return
			}
			setActiveDatasetId(id)
			localStorage.setItem('activeDatasetId', id)
		} catch {
			setMessage('Failed to load dataset.')
		} finally {
			setActivating(false)
		}
	}

	function downloadDataset(dataset) {
		const escape = (val) => {
			if (val === null || val === undefined) return ''
			const str = String(val)
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return '"' + str.replace(/"/g, '""') + '"'
			}
			return str
		}

		const header = dataset.columns.map(escape).join(',')
		const rows = dataset.rows.map((row) =>
			dataset.columns.map((col) => escape(row[col])).join(',')
		)
		const csv = [header, ...rows].join('\n')

		const blob = new Blob([csv], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = dataset.name.endsWith('.csv') ? dataset.name : dataset.name + '.csv'
		link.click()
		URL.revokeObjectURL(url)
	}

	async function downloadDatasetById(id) {
		try {
			const res = await fetch(`/api/datasets/${id}`)
			if (!res.ok) {
				setMessage('Failed to download dataset.')
				return
			}
			downloadDataset(await res.json())
		} catch {
			setMessage('Failed to download dataset.')
		}
	}

	async function deleteDataset(id) {
		try {
			const res = await fetch(`/api/datasets/${id}`, { method: 'DELETE' })
			if (!res.ok) {
				setMessage('Failed to delete dataset.')
				return
			}
		} catch {
			setMessage('Failed to delete dataset.')
			return
		}

		setDatasets((current) => current.filter((d) => d.id !== id))

		if (id === activeDatasetId) {
			setActiveDatasetId(null)
			localStorage.removeItem('activeDatasetId')
		}
	}

	async function handleSubmit(e) {
		e.preventDefault()

		if (!file) {
			setMessage('Please choose a CSV file.')
			return
		}

		const formData = new FormData()
		formData.append('file', file)

		setMessage('Uploading...')

		try {
			const uploadRes = await fetch('/api/datasets/upload', {
				method: 'POST',
				body: formData
			})

			const data = await uploadRes.json()

			if (!uploadRes.ok) {
				setMessage(data.error || 'Upload failed.')
				setPreview([])
				return
			}

			setMessage('Saving to database...')

			const newDataset = {
				id: Date.now().toString(),
				name: file.name,
				rows: data.rows || [],
				columns: data.columns || [],
				rowCount: data.rowCount || 0
			}

			const saveRes = await fetch('/api/datasets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newDataset)
			})

			if (!saveRes.ok) {
				const errData = await saveRes.json().catch(() => ({}))
				setMessage(`Failed to save to database: ${errData.error || saveRes.status}`)
				setPreview([])
				return
			}

			const metadata = await saveRes.json()

			setDatasets((current) => [...current, metadata])
			setActiveDatasetId(metadata.id)
			localStorage.setItem('activeDatasetId', metadata.id)

			setMessage(data.message || 'Upload successful!')
			setPreview(data.preview || [])

		} catch (error) {
			setMessage('Something went wrong. Please try again.')
			setPreview([])
		}
	}

	return (
		<main style={{ padding: '24px' }}>
			<h1>Datasets</h1>
			<p>Upload a CSV file to get started.</p>

			<form onSubmit={handleSubmit}>
				<input
					type="file"
					accept=".csv"
					onChange={(e) => setFile(e.target.files[0] || null)}
				/>

				<div style={{ marginTop: '12px' }}>
					<button type="submit">Upload CSV</button>
				</div>
			</form>

			{message && <p style={{ marginTop: '16px' }}>{message}</p>}
			{activating && <p>Loading dataset...</p>}

			{datasets.length > 0 && (
				<div style={{ marginTop: '24px' }}>
					<h2>Uploaded Datasets</h2>

					{datasets.map((dataset) => (
						<div key={dataset.id} style={{ marginBottom: '12px' }}>
							<strong>{dataset.name}</strong> — {dataset.rowCount} rows

							{dataset.id === activeDatasetId ? (
								<span> (active)</span>
							) : (
								<button
									type="button"
									onClick={() => activateDataset(dataset.id)}
									style={{ marginLeft: '12px' }}
									disabled={activating}
								>
									Set as active
								</button>
							)}

							<Link href={`/datasets/${dataset.id}/clean`} style={{ marginLeft: '12px' }}>
								Clean Data
							</Link>

							<button
								type="button"
								onClick={() => downloadDatasetById(dataset.id)}
								style={{ marginLeft: '12px' }}
							>
								Download
							</button>

							<button
								type="button"
								onClick={() => deleteDataset(dataset.id)}
								style={{ marginLeft: '12px' }}
							>
								Delete
							</button>
						</div>
					))}

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
