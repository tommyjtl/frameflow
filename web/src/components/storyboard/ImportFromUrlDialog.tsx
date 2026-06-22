import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SUPPORTED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]

type ImportFromUrlDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  onSubmit: (url: string) => Promise<void>
}

function validateImportUrlClient(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()

  if (!trimmed) {
    return 'URL is required.'
  }

  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    return 'Enter a valid URL.'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only HTTP and HTTPS URLs are supported.'
  }

  if (!SUPPORTED_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return 'Only YouTube URLs are supported.'
  }

  return null
}

export function ImportFromUrlDialog({
  open,
  onOpenChange,
  disabled = false,
  onSubmit,
}: ImportFromUrlDialogProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setUrl('')
      setError(null)
      setSubmitting(false)
    }

    onOpenChange(nextOpen)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateImportUrlClient(url)

    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(url.trim())
      handleOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not start import.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Import video from URL</DialogTitle>
            <DialogDescription>
              Paste a YouTube link. A placeholder card appears while the media
              downloads.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4">
            <Field className="gap-2" data-invalid={error ? true : undefined}>
              <Label htmlFor="import-url">URL</Label>
              <Input
                id="import-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.youtube.com/watch?v=…"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  if (error) {
                    setError(null)
                  }
                }}
                disabled={disabled || submitting}
                aria-invalid={error ? true : undefined}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={disabled || submitting}>
              {submitting ? 'Starting…' : 'Import'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
