import { Logo } from '@tabzen/shared/logo';
import styles from './Nav.module.css';

export function Nav() {
  return (
    <nav class={styles.nav}>
      <Logo size={20} showText textSize={18} />
      <div class={styles.links}>
        <a href="#features">Features</a>
        <a href="#showcase">How it works</a>
        <a href="#reviews">Reviews</a>
      </div>
      <a href="#" class={styles.cta}>Add to Chrome</a>
    </nav>
  );
}
