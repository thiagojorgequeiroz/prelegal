import type { Block, Run } from "@/lib/nda/model";

function RunView({ run }: { run: Run }) {
  if (run.href) {
    return (
      <a href={run.href} target="_blank" rel="noreferrer" className="text-navy underline decoration-primary">
        {run.text}
      </a>
    );
  }
  if (run.missing) {
    return <span className="rounded bg-accent/25 px-1 text-navy">{run.text}</span>;
  }
  if (run.filled) {
    return <span className="rounded bg-primary/10 px-0.5 text-navy whitespace-pre-line">{run.text}</span>;
  }
  return run.bold ? <strong>{run.text}</strong> : <>{run.text}</>;
}

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => <RunView key={i} run={run} />);
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading":
      if (block.level === 1) return <h1 className="mb-6 text-center text-2xl font-bold text-navy">{block.text}</h1>;
      if (block.level === 2) return <h2 className="mt-6 mb-2 text-lg font-bold text-navy uppercase">{block.text}</h2>;
      return <h3 className="mt-5 mb-1 font-bold">{block.text}</h3>;
    case "paragraph":
      return (
        <p className="mb-3">
          <Runs runs={block.runs} />
        </p>
      );
    case "numbered":
      return (
        <p className="mb-3">
          {block.number}. <Runs runs={block.runs} />
        </p>
      );
    case "signatures":
      return (
        <table className="my-6 w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-1/4 border border-stone-300 p-2" />
              {block.headers.map((h) => (
                <th key={h} className="border border-stone-300 p-2 text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="border border-stone-300 p-2 text-left align-top font-semibold">
                  {row.label}
                  {row.hint && <span className="block text-xs font-normal text-stone-500">{row.hint}</span>}
                </th>
                {row.values.map((value, i) => (
                  <td key={i} className="h-10 border border-stone-300 p-2 align-top break-words">
                    <RunView run={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "pageBreak":
      return <hr className="my-10 border-dashed border-stone-300" />;
  }
}

/** HTML rendering of the NDA document model, styled like a printed page. */
export function NdaPreview({ blocks }: { blocks: Block[] }) {
  return (
    <article className="mx-auto max-w-[8.5in] bg-white px-10 py-12 font-serif text-[15px] leading-relaxed text-stone-900 shadow-lg ring-1 ring-stone-200 sm:px-16">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </article>
  );
}
