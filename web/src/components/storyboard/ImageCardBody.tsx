type ImageCardBodyProps = {
  src: string
  alt: string
}

export function ImageCardBody({ src, alt }: ImageCardBodyProps) {
  return (
    <img
      className="image-card-body__preview"
      src={src}
      alt={alt}
      draggable={false}
    />
  )
}
