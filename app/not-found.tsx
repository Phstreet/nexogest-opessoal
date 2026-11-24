import Link from "next/link";
import styles from "./global-error.module.css";

export default function NotFound() {
  return (
    <main className={styles.body}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>NEXO · 404</p>
        <h1 className={styles.heading}>Página não encontrada</h1>
        <p className={styles.description}>
          O endereço pode ter sido alterado ou não existe.
        </p>
        <Link href="/" className={styles.link}>
          Voltar à Central do Dia
        </Link>
      </section>
    </main>
  );
}
