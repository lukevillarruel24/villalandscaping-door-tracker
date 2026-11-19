import { useEffect, useRef, useState } from 'react'
import { supabase, PHOTO_BUCKET } from '../lib/supabase.js'
import { useStore } from '../lib/store.jsx'
import { compressImage } from '../lib/images.js'
import { fmtDateTime } from '../lib/format.js'
import { Empty } from './ui.jsx'
import { Icon } from './Icon.jsx'

export default function Photos({ contactId }) {
  const { userId, showToast, nameOf } = useStore()
  const [photos, setPhotos] = useState(null)
  const [urls, setUrls] = useState({})
  const [uploading, setUploading] = useState(0)
  const [viewing, setViewing] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('photos')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
      if (!alive) return
      setPhotos(data || [])
      if (data?.length) {
        const signed = await sign(data.map((p) => p.path))
        if (alive) setUrls(signed)
      }
    })()
    return () => {
      alive = false
    }
  }, [contactId])

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setUploading(files.length)
    for (const file of files) {
      const blob = await compressImage(file)
      const path = `${contactId}/${crypto.randomUUID()}.jpg`
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) {
        showToast('Upload failed: ' + up.error.message)
        setUploading((n) => n - 1)
        continue
      }
      const { data, error } = await supabase
        .from('photos')
        .insert({ contact_id: contactId, path, created_by: userId })
        .select()
        .single()
      if (!error) {
        setPhotos((p) => [data, ...(p || [])])
        setUrls((u) => ({ ...u, [path]: URL.createObjectURL(blob) }))
      }
      setUploading((n) => n - 1)
    }
  }

  async function saveCaption(p, caption) {
    const { data, error } = await supabase.from('photos').update({ caption }).eq('id', p.id).select().single()
    if (error) return showToast(error.message)
    setPhotos((list) => list.map((x) => (x.id === p.id ? data : x)))
    setViewing(data)
  }

  async function del(p) {
    if (!window.confirm('Delete this photo?')) return
    await supabase.storage.from(PHOTO_BUCKET).remove([p.path])
    const { error } = await supabase.from('photos').delete().eq('id', p.id)
    if (error) return showToast(error.message)
    setPhotos((list) => list.filter((x) => x.id !== p.id))
    setViewing(null)
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <button className="btn primary block" onClick={() => fileRef.current.click()} disabled={uploading > 0}>
        <Icon name="camera" size={18} />
        {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
      </button>
      <p className="tiny muted center mt-sm">Take a new picture or pick from your camera roll.</p>

      {photos === null && <div className="muted small">Loading…</div>}
      {photos?.length === 0 && <Empty title="No photos yet">Before shots, measurements, finished job.</Empty>}
      <div className="photo-grid">
        {photos?.map((p) => (
          <button key={p.id} className="photo-thumb" onClick={() => setViewing(p)}>
            {urls[p.path] ? <img src={urls[p.path]} alt={p.caption || ''} loading="lazy" /> : <span className="spinner sm" />}
            {p.caption && <span className="photo-cap">{p.caption}</span>}
          </button>
        ))}
      </div>

      {viewing && (
        <Lightbox
          photo={viewing}
          url={urls[viewing.path]}
          by={nameOf(viewing.created_by)}
          onClose={() => setViewing(null)}
          onCaption={(c) => saveCaption(viewing, c)}
          onDelete={() => del(viewing)}
        />
      )}
    </div>
  )
}

function Lightbox({ photo, url, by, onClose, onCaption, onDelete }) {
  const [cap, setCap] = useState(photo.caption || '')
  return (
    <div className="lightbox">
      <div className="lightbox-top">
        <span className="small">
          {fmtDateTime(photo.created_at)} · {by}
        </span>
        <button className="icon-btn light" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="lightbox-img" onClick={onClose}>
        {url && <img src={url} alt={photo.caption || ''} onClick={(e) => e.stopPropagation()} />}
      </div>
      <div className="lightbox-bottom">
        <input placeholder="Add a caption" value={cap} onChange={(e) => setCap(e.target.value)} />
        <button className="btn sm" disabled={cap === (photo.caption || '')} onClick={() => onCaption(cap.trim() || null)}>
          Save
        </button>
        {url && (
          <a className="btn sm" href={url} target="_blank" rel="noreferrer">
            Full size
          </a>
        )}
        <button className="icon-btn light" onClick={onDelete} aria-label="Delete photo">
          <Icon name="trash" />
        </button>
      </div>
    </div>
  )
}

async function sign(paths) {
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60 * 6)
  const out = {}
  for (const r of data || []) if (r.signedUrl) out[r.path] = r.signedUrl
  return out
}
