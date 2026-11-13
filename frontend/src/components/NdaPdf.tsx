import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Block, Run } from "@/lib/nda/model";

const FONT = "Noto Serif";
let fontsRegistered = false;

/**
 * Registers the bundled Noto Serif font (`public/fonts`). PDF built-in fonts
 * only cover Latin-1, so names like "Łukasz" or "Ольга" would be garbled.
 * `baseUrl` is a URL in the browser or a directory path in Node (tests).
 */
export function registerPdfFonts(baseUrl: string) {
  if (fontsRegistered) return;
  Font.register({
    family: FONT,
    fonts: [
      { src: `${baseUrl}/NotoSerif-Regular.ttf` },
      { src: `${baseUrl}/NotoSerif-Bold.ttf`, fontWeight: "bold" },
    ],
  });
  // Legal text has long words; never break them with hyphens.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: { paddingVertical: 56, paddingHorizontal: 64, fontFamily: FONT, fontSize: 10, lineHeight: 1.45 },
  h1: { fontWeight: "bold", fontSize: 17, textAlign: "center", marginBottom: 18 },
  h2: { fontWeight: "bold", fontSize: 11.5, textTransform: "uppercase", marginTop: 12, marginBottom: 6 },
  h3: { fontWeight: "bold", fontSize: 10.5, marginTop: 10, marginBottom: 3 },
  paragraph: { marginBottom: 7 },
  bold: { fontWeight: "bold" },
  link: { color: "#1d4ed8" },
  table: { marginVertical: 14, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#a8a29e" },
  row: { flexDirection: "row" },
  cell: { flex: 2, minHeight: 26, padding: 5, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#a8a29e" },
  labelCell: { flex: 1 },
  hint: { fontSize: 8, color: "#78716c" },
  footer: { position: "absolute", bottom: 28, left: 64, right: 64, fontSize: 8, color: "#78716c", textAlign: "center" },
});

function RunPdf({ run }: { run: Run }) {
  if (run.href) {
    return (
      <Link src={run.href} style={styles.link}>
        {run.text}
      </Link>
    );
  }
  // Placeholders print as blanks to be completed by hand.
  if (run.missing) return <Text>{"_".repeat(18)}</Text>;
  return <Text style={run.bold ? styles.bold : undefined}>{run.text}</Text>;
}

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => <RunPdf key={i} run={run} />);
}

function BlockPdf({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading":
      return <Text style={styles[`h${block.level}`]}>{block.text}</Text>;
    case "paragraph":
      return (
        <Text style={styles.paragraph}>
          <Runs runs={block.runs} />
        </Text>
      );
    case "numbered":
      return (
        <Text style={styles.paragraph}>
          {block.number}. <Runs runs={block.runs} />
        </Text>
      );
    case "signatures":
      return (
        <View style={styles.table} wrap={false}>
          <View style={styles.row}>
            <View style={[styles.cell, styles.labelCell]} />
            {block.headers.map((h) => (
              <Text key={h} style={[styles.cell, styles.bold, { textAlign: "center" }]}>
                {h}
              </Text>
            ))}
          </View>
          {block.rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <View style={[styles.cell, styles.labelCell]}>
                <Text style={styles.bold}>{row.label}</Text>
                {row.hint && <Text style={styles.hint}>{row.hint}</Text>}
              </View>
              {row.values.map((value, i) => (
                <Text key={i} style={styles.cell}>
                  {value.missing ? "" : value.text}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "pageBreak":
      return <View break />;
  }
}

/** PDF rendering of the NDA document model. */
export function NdaPdf({ blocks }: { blocks: Block[] }) {
  return (
    <Document title="Mutual Non-Disclosure Agreement" creator="Prelegal">
      <Page size="LETTER" style={styles.page}>
        {blocks.map((block, i) => (
          <BlockPdf key={i} block={block} />
        ))}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Mutual NDA — Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
