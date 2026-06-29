interface Props {
  svg: string | null;
}

export default function SvgPreview({ svg }: Props) {
  return (
    <div className="preview">
      <div className="preview__board">
        {svg ? (
          <div className="preview__svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p className="preview__empty">Type some text to generate</p>
        )}
      </div>
    </div>
  );
}
