/**
 * Ground/satellite info popup for the Orbits stage. Purely presentational
 * and positioned by the parent via the `style` prop; no internal state.
 */

import type { CSSProperties } from "react";

export interface PopupField {
  label: string;
  value: string;
}

export interface PopupProps {
  title: string;
  /** CSS var name for the small identity swatch; null = no swatch. */
  swatchToken: string | null;
  fields: PopupField[];
  href: string | null;
  hrefLabel: string | null;
  secondaryHref?: string | null;
  secondaryLabel?: string | null;
  onClose(): void;
  /** Positioning supplied by the parent (absolute coords). */
  style?: CSSProperties;
}

export function Popup(props: PopupProps) {
  const {
    title,
    swatchToken,
    fields,
    href,
    hrefLabel,
    secondaryHref,
    secondaryLabel,
    onClose,
    style,
  } = props;

  return (
    <div className="opanel opopup" style={style} role="dialog">
      <div className="opopup-head">
        {swatchToken ? (
          <span className="oswatch" style={{ background: `var(${swatchToken})` }} aria-hidden="true" />
        ) : null}
        <span className="opopup-title">{title}</span>
        <button type="button" className="opopup-close" onClick={onClose} aria-label="Close">
          X
        </button>
      </div>
      {fields.map((field) => (
        <div className="okv" key={field.label}>
          <div className="okv-label">{field.label}</div>
          <div className="okv-value">{field.value}</div>
        </div>
      ))}
      {href || secondaryHref ? (
        <div className="opopup-foot">
          {href ? (
            <a className="opopup-link" href={href}>
              {(hrefLabel ?? href).toUpperCase()} &gt;
            </a>
          ) : null}
          {secondaryHref ? (
            <a className="opopup-link opopup-link-secondary" href={secondaryHref}>
              {(secondaryLabel ?? secondaryHref).toUpperCase()} &gt;
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
