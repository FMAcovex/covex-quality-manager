/** Usuario de la aplicación vinculado a un responsable en texto libre (D-101); no se imprime en los anexos. */
export function ResponsibleUserNote({ user }: { user?: { displayName: string } | null }) {
  return user ? <span className="muted-note responsible-user-note"><br />Usuario: {user.displayName}</span> : null;
}
