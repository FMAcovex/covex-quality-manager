import type { NumberedTable } from "@/lib/forms/text-tables";

/** D-127: tablas de un texto largo en la ficha, con su número en el expediente. */
export function TextTablesView({ items }: { items?: NumberedTable[] }) {
  if (!items?.length) return null;
  return (
    <>
      {items.map(({ number, table }) => (
        <figure key={number} className="text-table-view">
          <figcaption><strong>Tabla {number}.</strong> {table.title}</figcaption>
          <div className="text-table-scroll">
            <table className="text-table">
              <thead><tr>{table.columns.map((cell, index) => <th key={index} scope="col">{cell}</th>)}</tr></thead>
              <tbody>{table.rows.map((cells, row) => <tr key={row}>{cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </figure>
      ))}
    </>
  );
}
