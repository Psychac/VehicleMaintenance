import { rollColumns } from './gestures';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Digit-by-digit number transition (DESIGN.md S5.3). Each digit sits in a one-line window over a
 * 0-9 strip; changing the number slides the strip with spring.smooth, entirely in CSS, so it
 * costs no React renders per frame. Columns are keyed from the right, so the ones column stays
 * the ones column when the number grows. Tabular figures keep every digit the same width.
 *
 * The first render doesn't animate (CSS transitions need a change), and under Reduce Motion the
 * strip snaps. Assistive tech reads the whole value once.
 */
export function Roll({ text }: { text: string }) {
  return (
    <span className="ui-roll tnum" role="text" aria-label={text}>
      <span aria-hidden="true" className="ui-roll-inner">
        {rollColumns(text).map((c) =>
          c.digit === null ? (
            <span key={c.key} className="ui-roll-static">
              {c.char}
            </span>
          ) : (
            <span key={c.key} className="ui-roll-digit">
              <span className="ui-roll-strip" style={{ ['--d' as string]: c.digit }}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          )
        )}
      </span>
    </span>
  );
}
