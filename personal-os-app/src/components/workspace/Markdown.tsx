import type { ReactNode } from "react";
import { safeLink } from "@/lib/workspace";

/** 不接受原始 HTML 或脚本；所有文字由 React 转义。图片只显示安全链接，不自动访问外网。 */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[\[[^\]]+\]\]|!?\[[^\]]*\]\([^\s)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const [query, title] = part.slice(2, -2).split("|");
      return <a key={i} href={`/wiki?q=${encodeURIComponent(query)}`}>{title || query}</a>;
    }
    const link = part.match(/^(!?)\[([^\]]*)\]\(([^\s)]+)\)$/);
    if (link) {
      const href = safeLink(link[3]);
      return href ? <a key={i} href={href} target={href.startsWith("/") ? undefined : "_blank"} rel="noreferrer">{link[1] ? "查看图片：" : ""}{link[2] || "打开链接"}</a> : <span key={i}>{link[2] || "不安全的链接已禁用"}</span>;
    }
    return part;
  });
}
export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const output: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i]);
      output.push(<pre key={i}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const id = `section-${i}`;
      const children = inline(heading[2]);
      output.push(heading[1].length === 1 ? <h1 id={id} key={i}>{children}</h1> : heading[1].length === 2 ? <h2 id={id} key={i}>{children}</h2> : heading[1].length === 3 ? <h3 id={id} key={i}>{children}</h3> : <h4 id={id} key={i}>{children}</h4>);
      continue;
    }
    if (/^\s*[-*_]{3,}\s*$/.test(line)) { output.push(<hr key={i} />); continue; }
    if (/^\s*>/.test(line)) { output.push(<blockquote key={i}>{inline(line.replace(/^\s*>\s?/, ""))}</blockquote>); continue; }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const cells = (row: string) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
      const header = cells(line); const rows: string[][] = []; i++;
      while (i + 1 < lines.length && lines[i + 1].includes("|") && lines[i + 1].trim()) rows.push(cells(lines[++i]));
      output.push(<table key={i}><thead><tr>{header.map((cell, index) => <th key={index}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, j) => <td key={j}>{inline(cell)}</td>)}</tr>)}</tbody></table>);
      continue;
    }
    const list = line.match(/^\s*([-*]|\d+\.)\s+(.+)$/);
    if (list) {
      const numbered = /\d/.test(list[1]); const items: ReactNode[] = [<li key={i}>{inline(list[2])}</li>];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(numbered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*]\s+(.+)$/);
        if (!next) break;
        i++; items.push(<li key={i}>{inline(next[1])}</li>);
      }
      output.push(numbered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>); continue;
    }
    output.push(<p key={i}>{inline(line)}</p>);
  }
  return <div className="os-markdown">{output}</div>;
}
