import { textBlocks } from "@/lib/forms/bullets";

/**
 * D-126: muestra un texto largo con sus viñetas («• » al principio de línea) como lista. Un texto sin
 * viñetas se muestra igual que antes. `as="div"` para usarlo donde hoy hay un <p> (una lista no puede ir
 * dentro de un párrafo).
 */
export function FormattedText({ value, as, className }: { value: string | null | undefined; as?: "div"; className?: string }) {
  const text = value?.trim() ? value : "—";
  const blocks = textBlocks(text);
  const content = blocks.some((block) => block.kind === "bullets")
    ? blocks.map((block, index) => block.kind === "bullets"
      ? <ul key={index} className="text-bullets">{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
      : <span key={index} className="text-block">{block.text}</span>)
    : text;
  return as ? <div className={["formatted-text", className].filter(Boolean).join(" ")}>{content}</div> : <>{content}</>;
}
